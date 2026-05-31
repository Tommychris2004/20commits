import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { query, withTransaction } from '../db/index.js';
import { validate } from '../middleware/validate.js';
import { NotFoundError, ForbiddenError, BadRequestError } from '../middleware/errorHandler.js';
import type { TradingOfferRow, DeviceRow } from '../types/index.js';

export const tradingRouter = Router();
tradingRouter.use(requireAuth);

const COMMISSION_RATE = 0.03; // 3%

// ─── GET /api/trading/offers ──────────────────────────────────────────────────
tradingRouter.get('/offers', async (req, res, next) => {
  try {
    const user = req.user!;

    const myDeviceResult = await query<DeviceRow>(
      `SELECT id FROM devices WHERE user_id = $1 LIMIT 1`,
      [user.sub],
    );
    const myDeviceId = myDeviceResult.rows[0]?.id;

    const offersResult = await query<TradingOfferRow & { seller_node_id: string }>(
      `SELECT o.*, d.node_id AS seller_node_id
       FROM trading_offers o
       LEFT JOIN devices d ON d.id = o.seller_device_id
       WHERE o.status = 'active'
         AND (o.expires_at IS NULL OR o.expires_at > NOW())
         AND ($1::uuid IS NULL OR o.estate_id = $1)
       ORDER BY o.price_per_kwh ASC
       LIMIT 20`,
      [user.estateId ?? null],
    );

    const earningsResult = await query<{ total: string }>(
      `SELECT COALESCE(SUM(seller_naira), 0) AS total
       FROM energy_trades
       WHERE seller_device_id = $1
         AND traded_at >= date_trunc('month', NOW())`,
      [myDeviceId ?? '00000000-0000-0000-0000-000000000000'],
    );

    const allOffers = offersResult.rows.map((o) => ({
      id: o.id,
      seller_label: `Node ${(o.seller_node_id ?? 'UNKN').slice(-4).toUpperCase()}`,
      price_per_kwh: parseFloat(o.price_per_kwh as unknown as string),
      quantity_kwh: parseFloat(o.quantity_kwh as unknown as string),
      status: o.status,
      is_mine: o.seller_device_id === myDeviceId,
      created_at: o.created_at,
      expires_at: o.expires_at,
    }));

    res.json({
      offers: allOffers.filter((o) => !o.is_mine),
      my_offers: allOffers.filter((o) => o.is_mine),
      monthly_earnings_naira: parseFloat(earningsResult.rows[0]?.total ?? '0'),
      commission_rate_pct: COMMISSION_RATE * 100,
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/trading/offers ─────────────────────────────────────────────────
const createOfferSchema = z.object({
  price_per_kwh: z.number().positive().max(2000),
  quantity_kwh: z.number().positive().max(100),
});

tradingRouter.post('/offers', validate(createOfferSchema), async (req, res, next) => {
  try {
    const user = req.user!;
    const { price_per_kwh, quantity_kwh } = req.body as z.infer<typeof createOfferSchema>;

    const deviceResult = await query<DeviceRow>(
      `SELECT id FROM devices WHERE user_id = $1 LIMIT 1`,
      [user.sub],
    );
    const device = deviceResult.rows[0];
    if (!device) throw new ForbiddenError('No Smart Node registered');

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const result = await query<TradingOfferRow>(
      `INSERT INTO trading_offers
         (seller_device_id, estate_id, price_per_kwh, quantity_kwh, expires_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [device.id, user.estateId ?? null, price_per_kwh, quantity_kwh, expiresAt.toISOString()],
    );

    res.status(201).json({ offer: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/trading/offers/:id ───────────────────────────────────────────
const updateOfferSchema = z.object({
  price_per_kwh: z.number().positive().max(2000).optional(),
  quantity_kwh: z.number().positive().max(100).optional(),
  status: z.enum(['active', 'cancelled']).optional(),
});

tradingRouter.patch('/offers/:id', validate(updateOfferSchema), async (req, res, next) => {
  try {
    const user = req.user!;
    const { price_per_kwh, quantity_kwh, status } = req.body as z.infer<typeof updateOfferSchema>;

    const deviceResult = await query<DeviceRow>(
      `SELECT id FROM devices WHERE user_id = $1 LIMIT 1`,
      [user.sub],
    );
    const myDeviceId = deviceResult.rows[0]?.id;

    const sets: string[] = [];
    const vals: unknown[] = [req.params.id, myDeviceId];
    if (price_per_kwh !== undefined) { vals.push(price_per_kwh); sets.push(`price_per_kwh = $${vals.length}`); }
    if (quantity_kwh !== undefined)  { vals.push(quantity_kwh);  sets.push(`quantity_kwh = $${vals.length}`); }
    if (status !== undefined)        { vals.push(status);        sets.push(`status = $${vals.length}`); }

    if (sets.length === 0) throw new BadRequestError('Nothing to update');

    const result = await query(
      `UPDATE trading_offers SET ${sets.join(', ')} WHERE id = $1 AND seller_device_id = $2`,
      vals,
    );
    if (!result.rowCount || result.rowCount === 0) throw new NotFoundError('Offer');

    res.json({ status: 'ok' });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/trading/offers/:id/buy ────────────────────────────────────────
const buySchema = z.object({
  quantity_kwh: z.number().positive(),
});

tradingRouter.post('/offers/:id/buy', validate(buySchema), async (req, res, next) => {
  try {
    const user = req.user!;
    const { quantity_kwh } = req.body as z.infer<typeof buySchema>;

    const result = await withTransaction(async (client) => {
      const offerRes = await client.query<TradingOfferRow>(
        `SELECT * FROM trading_offers WHERE id = $1 AND status = 'active' FOR UPDATE`,
        [req.params.id],
      );
      const offer = offerRes.rows[0];
      if (!offer) throw new NotFoundError('Offer');

      const available = parseFloat(offer.quantity_kwh as unknown as string);
      if (quantity_kwh > available) throw new BadRequestError(`Only ${available.toFixed(3)} kWh available`);

      const myDeviceRes = await client.query<DeviceRow>(
        `SELECT id FROM devices WHERE user_id = $1 LIMIT 1`,
        [user.sub],
      );
      if (myDeviceRes.rows[0]?.id === offer.seller_device_id) {
        throw new BadRequestError('Cannot buy your own offer');
      }

      const pricePerKwh = parseFloat(offer.price_per_kwh as unknown as string);
      const gross = parseFloat((quantity_kwh * pricePerKwh).toFixed(2));
      const commission = parseFloat((gross * COMMISSION_RATE).toFixed(2));
      const sellerNet = parseFloat((gross - commission).toFixed(2));
      const remaining = parseFloat((available - quantity_kwh).toFixed(4));

      if (remaining < 0.001) {
        await client.query(
          `UPDATE trading_offers SET status = 'matched', quantity_kwh = 0 WHERE id = $1`,
          [offer.id],
        );
      } else {
        await client.query(`UPDATE trading_offers SET quantity_kwh = $1 WHERE id = $2`, [remaining, offer.id]);
      }

      const tradeRes = await client.query(
        `INSERT INTO energy_trades
           (offer_id, buyer_user_id, seller_device_id, estate_id,
            quantity_kwh, price_per_kwh, gross_naira, commission_naira, seller_naira)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [offer.id, user.sub, offer.seller_device_id, offer.estate_id,
         quantity_kwh, pricePerKwh, gross, commission, sellerNet],
      );

      return { trade: tradeRes.rows[0], gross, commission };
    });

    res.status(201).json({
      trade: result.trade,
      summary: {
        quantity_kwh,
        gross_naira: result.gross,
        commission_naira: result.commission,
        you_pay_naira: result.gross,
        settlement: 'mobile_money',
        message: 'Trade confirmed. Settlement via mobile money within 60 seconds.',
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/trading/history ─────────────────────────────────────────────────
tradingRouter.get('/history', async (req, res, next) => {
  try {
    const user = req.user!;

    const deviceResult = await query<DeviceRow>(
      `SELECT id FROM devices WHERE user_id = $1 LIMIT 1`,
      [user.sub],
    );
    const myDeviceId = deviceResult.rows[0]?.id ?? '00000000-0000-0000-0000-000000000000';

    const result = await query<{
      id: string; quantity_kwh: string; price_per_kwh: string;
      gross_naira: string; seller_naira: string; status: string;
      traded_at: string; side: string; seller_node_id: string;
    }>(
      `SELECT
         t.id, t.quantity_kwh, t.price_per_kwh, t.gross_naira,
         t.seller_naira, t.status, t.traded_at,
         CASE WHEN t.buyer_user_id = $1 THEN 'buy' ELSE 'sell' END AS side,
         d.node_id AS seller_node_id
       FROM energy_trades t
       LEFT JOIN devices d ON d.id = t.seller_device_id
       WHERE t.buyer_user_id = $1 OR t.seller_device_id = $2
       ORDER BY t.traded_at DESC
       LIMIT 50`,
      [user.sub, myDeviceId],
    );

    const trades = result.rows.map((t) => ({
      id: t.id,
      side: t.side as 'buy' | 'sell',
      seller_label: `Node ${(t.seller_node_id ?? 'UNKN').slice(-4).toUpperCase()}`,
      quantity_kwh: parseFloat(t.quantity_kwh),
      price_per_kwh: parseFloat(t.price_per_kwh),
      gross_naira: parseFloat(t.gross_naira),
      seller_naira: parseFloat(t.seller_naira),
      status: t.status,
      traded_at: t.traded_at,
    }));

    res.json({ trades });
  } catch (err) {
    next(err);
  }
});

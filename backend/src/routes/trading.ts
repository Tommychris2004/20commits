import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { query } from '../db/index.js';
import { validate } from '../middleware/validate.js';
import { NotFoundError, ForbiddenError } from '../middleware/errorHandler.js';
import type { TradingOfferRow, DeviceRow } from '../types/index.js';

export const tradingRouter = Router();

tradingRouter.use(requireAuth);

// GET /api/trading/offers — marketplace
tradingRouter.get('/offers', async (req, res, next) => {
  try {
    const user = req.user!;

    if (!user.estateId) {
      res.json({
        offers: [],
        my_offers: [],
        monthly_earnings_naira: 0,
        note: 'Trading is available within registered mini-grid clusters (Position B). MONITORING ONLY in this build.',
      });
      return;
    }

    const result = await query<TradingOfferRow & { seller_node_id: string }>(
      `SELECT o.*, d.node_id AS seller_node_id
       FROM trading_offers o
       LEFT JOIN devices d ON d.id = o.seller_device_id
       WHERE o.estate_id = $1
         AND o.status = 'active'
         AND (o.expires_at IS NULL OR o.expires_at > NOW())
       ORDER BY o.price_per_kwh ASC`,
      [user.estateId],
    );

    // Get user's device to identify "my" offers
    const myDeviceResult = await query<DeviceRow>(
      `SELECT id FROM devices WHERE user_id = $1 LIMIT 1`,
      [user.sub],
    );
    const myDeviceId = myDeviceResult.rows[0]?.id;

    const allOffers = result.rows.map((o) => ({
      id: o.id,
      seller_label: `Node ${o.seller_node_id?.slice(-4).toUpperCase() ?? 'Unknown'}`,
      price_per_kwh: parseFloat(o.price_per_kwh),
      quantity_kwh: parseFloat(o.quantity_kwh),
      status: o.status,
      is_mine: o.seller_device_id === myDeviceId,
      created_at: o.created_at,
    }));

    res.json({
      offers: allOffers.filter((o) => !o.is_mine),
      my_offers: allOffers.filter((o) => o.is_mine),
      monthly_earnings_naira: 0,
      disclaimer:
        'Energy trading operates within a registered mini-grid cluster only. Settlement requires NEMSA-certified metering. This is a MONITORING build — no real energy is traded.',
    });
  } catch (err) {
    next(err);
  }
});

const createOfferSchema = z.object({
  price_per_kwh: z.number().positive().max(2000),
  quantity_kwh: z.number().positive().max(100),
});

// POST /api/trading/offers — create offer
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
    if (!user.estateId) throw new ForbiddenError('Not part of an estate cluster');

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const result = await query<TradingOfferRow>(
      `INSERT INTO trading_offers (seller_device_id, estate_id, price_per_kwh, quantity_kwh, expires_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [device.id, user.estateId, price_per_kwh, quantity_kwh, expiresAt.toISOString()],
    );

    res.status(201).json({ offer: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/trading/offers/:id
tradingRouter.delete('/offers/:id', async (req, res, next) => {
  try {
    const user = req.user!;

    const deviceResult = await query<DeviceRow>(
      `SELECT id FROM devices WHERE user_id = $1 LIMIT 1`,
      [user.sub],
    );
    const myDeviceId = deviceResult.rows[0]?.id;

    const result = await query(
      `UPDATE trading_offers SET status = 'cancelled'
       WHERE id = $1 AND seller_device_id = $2`,
      [req.params.id, myDeviceId],
    );

    if (!result.rowCount || result.rowCount === 0) throw new NotFoundError('Offer');

    res.json({ status: 'ok' });
  } catch (err) {
    next(err);
  }
});

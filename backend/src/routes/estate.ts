import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireManager } from '../middleware/auth.js';
import { query } from '../db/index.js';
import { validate } from '../middleware/validate.js';
import { NotFoundError, ForbiddenError } from '../middleware/errorHandler.js';
import type { DeviceRow, EstateRow } from '../types/index.js';

export const estateRouter = Router();

estateRouter.use(requireAuth);

// GET /api/estate — estate overview
estateRouter.get('/', async (req, res, next) => {
  try {
    const user = req.user!;

    if (!user.estateId) {
      res.json({ has_estate: false, message: 'Not part of an estate' });
      return;
    }

    const [estateResult, devicesResult] = await Promise.all([
      query<EstateRow>('SELECT * FROM estates WHERE id = $1', [user.estateId]),
      query<DeviceRow & { user_name: string }>(
        `SELECT d.*, u.name AS user_name
         FROM devices d
         LEFT JOIN users u ON u.id = d.user_id
         WHERE d.estate_id = $1
         ORDER BY d.created_at`,
        [user.estateId],
      ),
    ]);

    const estate = estateResult.rows[0];
    if (!estate) throw new NotFoundError('Estate');

    const devices = devicesResult.rows;
    const onlineCount = devices.filter((d) => d.status === 'online').length;
    const offlineCount = devices.filter((d) => d.status === 'offline').length;
    const notConnected = devices.filter((d) => d.status === 'not_connected').length;

    // Collective savings estimate (mocked aggregate — TODO: compute from readings)
    const connectedKw = devices.filter((d) => d.status === 'online').length * 2.5;

    res.json({
      has_estate: true,
      estate: {
        id: estate.id,
        name: estate.name,
        location: estate.location,
        state: estate.state,
      },
      nodes: {
        total: devices.length,
        online: onlineCount,
        offline: offlineCount,
        not_connected: notConnected,
        connected_capacity_kw: connectedKw,
      },
      collective_savings_naira_month: onlineCount * 45000,
      devices: devices.map((d) => ({
        id: d.id,
        node_id: d.node_id,
        name: d.name,
        status: d.status,
        last_seen: d.last_seen,
        user_name: d.user_name ?? 'Resident',
      })),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/estate/network — anonymised leaderboard
estateRouter.get('/network', async (req, res, next) => {
  try {
    const user = req.user!;
    if (!user.estateId) {
      res.json({ leaderboard: [] });
      return;
    }

    // Rank homes by total solar kWh this month
    const result = await query<{ device_id: string; solar_kwh: string }>(
      `SELECT
         r.device_id,
         COALESCE(SUM(r.energy_kwh), 0)::numeric(12,4) AS solar_kwh
       FROM readings r
       JOIN devices d ON d.id = r.device_id
       WHERE d.estate_id = $1
         AND r.source = 'solar'
         AND r.timestamp >= date_trunc('month', NOW())
       GROUP BY r.device_id
       ORDER BY solar_kwh DESC`,
      [user.estateId],
    );

    const leaderboard = result.rows.map((row, idx) => ({
      rank: idx + 1,
      label: `Home ${String.fromCharCode(65 + idx)}`,
      solar_kwh: parseFloat(row.solar_kwh),
      co2_kg: parseFloat(row.solar_kwh) * 0.75,
      is_me: false, // TODO: match user's device_id
    }));

    res.json({ leaderboard });
  } catch (err) {
    next(err);
  }
});

// POST /api/estate/broadcast — estate manager only
const broadcastSchema = z.object({
  message: z.string().min(1).max(500),
});

estateRouter.post('/broadcast', requireManager, validate(broadcastSchema), async (req, res, next) => {
  try {
    const user = req.user!;
    if (!user.estateId) throw new ForbiddenError('Not part of an estate');

    const { message } = req.body as z.infer<typeof broadcastSchema>;

    // In production: push via FCM/websocket. Here we log and return ok.
    console.info(`[broadcast] Estate ${user.estateId}: "${message}"`);

    res.json({
      status: 'ok',
      message: 'Broadcast queued for delivery to all estate residents.',
      preview: message,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/estate — create a new estate
const createEstateSchema = z.object({
  name: z.string().min(1).max(200),
  location: z.string().min(1),
  state: z.string().min(1),
});

estateRouter.post('/', validate(createEstateSchema), async (req, res, next) => {
  try {
    const { name, location, state } = req.body as z.infer<typeof createEstateSchema>;

    const result = await query<EstateRow>(
      `INSERT INTO estates (name, location, state) VALUES ($1, $2, $3) RETURNING *`,
      [name, location, state],
    );

    const estate = result.rows[0];

    // Promote creator to estate_manager
    await query(
      `UPDATE users SET estate_id = $1, role = 'estate_manager' WHERE id = $2`,
      [estate.id, req.user!.sub],
    );

    res.status(201).json({ estate });
  } catch (err) {
    next(err);
  }
});

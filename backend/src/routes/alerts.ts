import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { query } from '../db/index.js';
import { evaluateAlerts } from '../services/alertsService.js';
import { validate } from '../middleware/validate.js';
import type { DeviceRow } from '../types/index.js';

export const alertsRouter = Router();

alertsRouter.use(requireAuth);

// GET /api/me/alerts
alertsRouter.get('/', async (req, res, next) => {
  try {
    const userId = req.user!.sub;

    const deviceResult = await query<DeviceRow>(
      `SELECT * FROM devices WHERE user_id = $1 ORDER BY created_at LIMIT 1`,
      [userId],
    );

    if (!deviceResult.rowCount || deviceResult.rowCount === 0) {
      res.json({ alerts: [], note: 'Connect your Smart Node to receive personalised alerts.' });
      return;
    }

    const device = deviceResult.rows[0];
    const alerts = await evaluateAlerts(device.id);

    res.json({ alerts });
  } catch (err) {
    next(err);
  }
});

// POST /api/me/alerts/:id/dismiss
const dismissSchema = z.object({ id: z.string().uuid() });
alertsRouter.post('/:id/dismiss', validate(dismissSchema, 'params'), async (req, res, next) => {
  try {
    await query(
      `UPDATE alerts_log SET dismissed_at = NOW() WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user!.sub],
    );
    res.json({ status: 'ok' });
  } catch (err) {
    next(err);
  }
});

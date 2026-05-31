import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { query } from '../db/index.js';
import { getTodaySummary } from '../services/analyticsService.js';
import { NotFoundError } from '../middleware/errorHandler.js';
import type { DeviceRow } from '../types/index.js';

export const energyRouter = Router();

energyRouter.use(requireAuth);

// GET /api/me/energy
energyRouter.get('/', async (req, res, next) => {
  try {
    const userId = req.user!.sub;

    // Get user's primary device
    const deviceResult = await query<DeviceRow>(
      `SELECT * FROM devices WHERE user_id = $1 ORDER BY created_at LIMIT 1`,
      [userId],
    );

    if (!deviceResult.rowCount || deviceResult.rowCount === 0) {
      // Return empty state for users without a device
      res.json({
        has_device: false,
        message: 'No Smart Node connected. Connect your device to see real-time data.',
      });
      return;
    }

    const device = deviceResult.rows[0];
    const summary = await getTodaySummary(device.id);

    res.json({
      has_device: true,
      device: {
        id: device.id,
        node_id: device.node_id,
        name: device.name,
        status: device.status,
        last_seen: device.last_seen,
      },
      current_power_kw: summary.current_power_kw,
      today: {
        total_kwh: summary.breakdown.total_kwh,
        total_cost_naira: summary.breakdown.total_cost_naira,
        by_source: summary.breakdown.by_source,
        savings_naira: summary.breakdown.savings_naira,
        blended_rate_naira_per_kwh: summary.breakdown.blended_rate_naira_per_kwh,
      },
      projected_monthly_cost_naira: summary.projected_monthly_cost_naira,
    });
  } catch (err) {
    next(err);
  }
});

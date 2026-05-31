import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { query } from '../db/index.js';
import {
  getWeeklyHistory,
  getHourlyToday,
  computeCostBreakdown,
} from '../services/analyticsService.js';
import type { DeviceRow, EnergySource } from '../types/index.js';

export const analyticsRouter = Router();

analyticsRouter.use(requireAuth);

// GET /api/me/history
analyticsRouter.get('/', async (req, res, next) => {
  try {
    const userId = req.user!.sub;

    const deviceResult = await query<DeviceRow>(
      `SELECT * FROM devices WHERE user_id = $1 ORDER BY created_at LIMIT 1`,
      [userId],
    );

    if (!deviceResult.rowCount || deviceResult.rowCount === 0) {
      res.json({ has_device: false, history: [], hourly: [], week_comparison: null });
      return;
    }

    const device = deviceResult.rows[0];

    const [weekHistory, hourly] = await Promise.all([
      getWeeklyHistory(device.id),
      getHourlyToday(device.id),
    ]);

    // Week-over-week comparison
    const thisWeekCost = weekHistory.slice(0, 7).reduce((s, d) => s + d.total_cost_naira, 0);

    const lastWeekResult = await query<{ source: EnergySource; energy_kwh: string }>(
      `SELECT source, energy_kwh
       FROM readings
       WHERE device_id = $1
         AND timestamp >= NOW() - INTERVAL '14 days'
         AND timestamp < NOW() - INTERVAL '7 days'`,
      [device.id],
    );

    const lastWeekReadings = lastWeekResult.rows.map((r) => ({
      source: r.source,
      energy_kwh: parseFloat(r.energy_kwh),
    }));
    const lastWeekBreakdown = computeCostBreakdown(lastWeekReadings);
    const lastWeekCost = lastWeekBreakdown.total_cost_naira;

    const weekChangePct =
      lastWeekCost > 0
        ? Math.round(((thisWeekCost - lastWeekCost) / lastWeekCost) * 100)
        : 0;

    // Peak hour in today's hourly data
    const peakHour = hourly.reduce(
      (peak, h) => (h.total_kwh > peak.total_kwh ? h : peak),
      hourly[0],
    );

    res.json({
      has_device: true,
      weekly: weekHistory,
      hourly: hourly.map((h) => ({
        ...h,
        is_peak: h.hour === peakHour.hour,
      })),
      week_comparison: {
        this_week_cost_naira: thisWeekCost,
        last_week_cost_naira: lastWeekCost,
        change_pct: weekChangePct,
        direction: weekChangePct >= 0 ? 'up' : 'down',
      },
      note: 'Appliance-level breakdown (AC 45%, etc.) requires per-circuit sensors or load disaggregation — not available with a single whole-house Smart Node.',
    });
  } catch (err) {
    next(err);
  }
});

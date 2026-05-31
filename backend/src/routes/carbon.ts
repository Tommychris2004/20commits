import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { query } from '../db/index.js';
import {
  getMonthlyCarbon,
  getCarbonLedger,
  computeImpactEquivalences,
} from '../services/carbonService.js';
import type { DeviceRow } from '../types/index.js';

export const carbonRouter = Router();

carbonRouter.use(requireAuth);

// GET /api/me/carbon
carbonRouter.get('/', async (req, res, next) => {
  try {
    const userId = req.user!.sub;

    const deviceResult = await query<DeviceRow>(
      `SELECT * FROM devices WHERE user_id = $1 ORDER BY created_at LIMIT 1`,
      [userId],
    );

    if (!deviceResult.rowCount || deviceResult.rowCount === 0) {
      res.json({
        has_device: false,
        message: 'Connect your Smart Node to start earning carbon credits.',
      });
      return;
    }

    const device = deviceResult.rows[0];
    const [summary] = await Promise.all([getMonthlyCarbon(device.id)]);
    const equivalences = computeImpactEquivalences(summary.co2_avoided_kg);

    // All-time CO2
    const allTimeResult = await query<{ solar_kwh: string }>(
      `SELECT COALESCE(SUM(energy_kwh), 0)::numeric(12,4) AS solar_kwh
       FROM readings
       WHERE device_id = $1 AND source = 'solar'`,
      [device.id],
    );
    const allTimeSolarKwh = parseFloat(allTimeResult.rows[0]?.solar_kwh ?? '0');
    const allTimeCo2Kg = allTimeSolarKwh * 0.75;

    // Next payout estimate: Q1=Jan1, Q2=Apr1, Q3=Jul1, Q4=Oct1
    const now = new Date();
    const quarter = Math.floor(now.getMonth() / 3);
    const nextPayoutDate = new Date(now.getFullYear(), (quarter + 1) * 3, 1);

    res.json({
      has_device: true,
      this_month: {
        solar_kwh: summary.solar_kwh,
        co2_avoided_kg: summary.co2_avoided_kg,
        credits_earned: summary.credits_earned,
        credit_value_naira: summary.credit_value_naira,
        estimated_payout_naira: summary.estimated_payout_naira,
      },
      all_time: {
        solar_kwh: allTimeSolarKwh,
        co2_avoided_kg: allTimeCo2Kg,
        credits_earned: allTimeCo2Kg / 1000,
      },
      impact: equivalences,
      next_payout: {
        date: nextPayoutDate.toISOString().split('T')[0],
        estimated_naira: summary.estimated_payout_naira,
      },
      pool_progress: {
        current_tonnes: Math.round(allTimeCo2Kg / 1000 * 10) / 10,
        target_tonnes: 10000,
        pct: Math.min(100, Math.round((allTimeCo2Kg / 1000 / 10000) * 100 * 100) / 100),
      },
      methodology: summary.methodology,
      disclaimer:
        'Carbon credit estimates only. Actual payouts subject to third-party verification (Verra VCS) and pool accumulation. This is NOT a carbon credit sale.',
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/me/carbon/ledger
carbonRouter.get('/ledger', async (req, res, next) => {
  try {
    const userId = req.user!.sub;

    const deviceResult = await query<DeviceRow>(
      `SELECT * FROM devices WHERE user_id = $1 ORDER BY created_at LIMIT 1`,
      [userId],
    );

    if (!deviceResult.rowCount || deviceResult.rowCount === 0) {
      res.json({ ledger: [] });
      return;
    }

    const device = deviceResult.rows[0];
    const ledger = await getCarbonLedger(device.id);

    res.json({ ledger });
  } catch (err) {
    next(err);
  }
});

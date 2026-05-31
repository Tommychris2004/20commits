import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { query } from '../db/index.js';
import { validate } from '../middleware/validate.js';
import { BadRequestError } from '../middleware/errorHandler.js';
import type { DeviceRow, FinancingApplicationRow } from '../types/index.js';

export const financingRouter = Router();

financingRouter.use(requireAuth);

const SYSTEM_OPTIONS = [
  { size_kw: 1, price_naira: 350_000, generation_kwh_day: 4 },
  { size_kw: 2, price_naira: 550_000, generation_kwh_day: 8 },
  { size_kw: 5, price_naira: 950_000, generation_kwh_day: 20 },
];

const INTEREST_RATE_MONTHLY = 0.025; // 2.5% per month (30% APR — partner bank rate)
const GENERATOR_COST_PER_KWH = 450;
const MIN_MONTHS_DATA_FOR_ELIGIBILITY = 1;

// GET /api/me/financing/eligibility
financingRouter.get('/eligibility', async (req, res, next) => {
  try {
    const userId = req.user!.sub;

    const deviceResult = await query<DeviceRow>(
      `SELECT * FROM devices WHERE user_id = $1 LIMIT 1`,
      [userId],
    );

    // Check data history
    const historyResult = await query<{ months: string; avg_monthly_kwh: string }>(
      `SELECT
         COUNT(DISTINCT to_char(timestamp, 'YYYY-MM')) AS months,
         AVG(daily_kwh)::numeric(10,4) AS avg_monthly_kwh
       FROM (
         SELECT
           to_char(timestamp, 'YYYY-MM-DD') AS day,
           SUM(energy_kwh) AS daily_kwh
         FROM readings
         WHERE device_id = ANY(
           SELECT id FROM devices WHERE user_id = $1
         )
         GROUP BY day
       ) daily`,
      [userId],
    );

    const row = historyResult.rows[0];
    const monthsData = parseInt(row?.months ?? '0');
    const avgDailyKwh = parseFloat(row?.avg_monthly_kwh ?? '0');
    const avgMonthlyKwh = avgDailyKwh * 30;
    const hasDevice = !!deviceResult.rows[0];

    const eligible = hasDevice && monthsData >= MIN_MONTHS_DATA_FOR_ELIGIBILITY;

    // Financing ceiling: up to 18× monthly generator spend
    const monthlyGeneratorCost = avgMonthlyKwh * GENERATOR_COST_PER_KWH;
    const ceilingNaira = Math.min(950_000, Math.max(350_000, monthlyGeneratorCost * 18));

    // Monthly payment calculator
    const calcMonthlyPayment = (principal: number, months: number) => {
      const r = INTEREST_RATE_MONTHLY;
      return Math.round(principal * r * Math.pow(1 + r, months) / (Math.pow(1 + r, months) - 1));
    };

    const options = SYSTEM_OPTIONS.filter((o) => o.price_naira <= ceilingNaira).map((o) => ({
      ...o,
      terms: [12, 24, 36].map((months) => ({
        months,
        monthly_payment: calcMonthlyPayment(o.price_naira, months),
        total_cost: calcMonthlyPayment(o.price_naira, months) * months,
        monthly_generator_saved_naira: Math.round(
          o.generation_kwh_day * 30 * GENERATOR_COST_PER_KWH,
        ),
      })),
    }));

    res.json({
      eligible,
      ceiling_naira: Math.round(ceilingNaira),
      months_of_data: monthsData,
      avg_monthly_kwh: Math.round(avgMonthlyKwh),
      current_monthly_generator_cost: Math.round(monthlyGeneratorCost),
      system_options: options,
      note: eligible
        ? 'Eligibility based on your energy usage history. Partner bank approval subject to their underwriting criteria.'
        : 'Connect your Smart Node and generate at least 1 month of data to check eligibility.',
      disclaimer: 'GridNode does not custody or disburse loans. Applications are passed to partner banks for underwriting.',
    });
  } catch (err) {
    next(err);
  }
});

const applySchema = z.object({
  system_size_kw: z.number().refine((v) => [1, 2, 5].includes(v), 'Invalid system size'),
  term_months: z.number().refine((v) => [12, 24, 36].includes(v), 'Invalid term'),
});

// POST /api/me/financing/apply
financingRouter.post('/apply', validate(applySchema), async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const { system_size_kw, term_months } = req.body as z.infer<typeof applySchema>;

    const option = SYSTEM_OPTIONS.find((o) => o.size_kw === system_size_kw);
    if (!option) throw new BadRequestError('Invalid system size');

    const r = INTEREST_RATE_MONTHLY;
    const monthlyPayment = Math.round(
      option.price_naira * r * Math.pow(1 + r, term_months) / (Math.pow(1 + r, term_months) - 1),
    );

    const result = await query<FinancingApplicationRow>(
      `INSERT INTO financing_applications
         (user_id, system_size_kw, loan_amount_naira, term_months, monthly_payment)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, system_size_kw, option.price_naira, term_months, monthlyPayment],
    );

    res.status(201).json({
      application: result.rows[0],
      message: 'Application submitted. Partner bank will review within 48 hours.',
      monthly_payment: monthlyPayment,
      loan_amount: option.price_naira,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/me/financing
financingRouter.get('/', async (req, res, next) => {
  try {
    const result = await query<FinancingApplicationRow>(
      `SELECT * FROM financing_applications WHERE user_id = $1 ORDER BY submitted_at DESC`,
      [req.user!.sub],
    );
    res.json({ applications: result.rows });
  } catch (err) {
    next(err);
  }
});

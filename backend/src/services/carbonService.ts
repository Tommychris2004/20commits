import { query } from '../db/index.js';
import { config } from '../config.js';
import type { CarbonSummary } from '../types/index.js';

const EMISSION_FACTOR_KG_PER_KWH = config.CO2_FACTOR_KG_PER_KWH; // 0.75 kg CO2/kWh
const USER_SHARE = 1 - config.GRIDNODE_CARBON_FEE_PCT; // 70%

/**
 * Pure function: given solar kWh, compute the full carbon summary.
 * Testable without database access.
 */
export function computeCarbonSummary(solarKwh: number): CarbonSummary {
  const co2AvoidedKg = solarKwh * EMISSION_FACTOR_KG_PER_KWH;
  const creditsEarned = co2AvoidedKg / 1000; // tonnes
  const creditValueUsd = creditsEarned * config.CARBON_MARKET_PRICE_USD;
  const creditValueNaira = creditValueUsd * config.NGN_USD_RATE;
  const estimatedPayoutNaira = creditValueNaira * USER_SHARE;

  return {
    solar_kwh: solarKwh,
    co2_avoided_kg: co2AvoidedKg,
    credits_earned: creditsEarned,
    credit_value_usd: creditValueUsd,
    credit_value_naira: creditValueNaira,
    estimated_payout_naira: estimatedPayoutNaira,
    methodology:
      'Verra VCS — diesel generator displacement baseline. Nigeria emission factor 0.75 kg CO2/kWh. Estimates only — subject to third-party verification.',
  };
}

/**
 * Fetch this month's carbon summary for a device.
 */
export async function getMonthlyCarbon(deviceId: string): Promise<CarbonSummary> {
  const result = await query<{ solar_kwh: string }>(
    `SELECT COALESCE(SUM(energy_kwh), 0)::numeric(12,4) AS solar_kwh
     FROM readings
     WHERE device_id = $1
       AND source = 'solar'
       AND timestamp >= date_trunc('month', NOW())`,
    [deviceId],
  );

  const solarKwh = parseFloat(result.rows[0]?.solar_kwh ?? '0');
  return computeCarbonSummary(solarKwh);
}

/**
 * Fetch all-time carbon ledger entries for a device.
 */
export async function getCarbonLedger(deviceId: string) {
  const result = await query(
    `SELECT
       id,
       period_start,
       period_end,
       solar_kwh::float8,
       co2_avoided_kg::float8,
       credits_earned::float8,
       payout_naira::float8,
       status,
       created_at
     FROM carbon_ledger
     WHERE device_id = $1
     ORDER BY period_start DESC`,
    [deviceId],
  );
  return result.rows;
}

/**
 * Upsert a carbon ledger record for the current month.
 * Called by a scheduled job (or manually during testing).
 */
export async function upsertMonthlyLedger(deviceId: string): Promise<void> {
  const summary = await getMonthlyCarbon(deviceId);

  const periodStart = new Date();
  periodStart.setDate(1);
  periodStart.setHours(0, 0, 0, 0);

  const periodEnd = new Date(periodStart);
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  await query(
    `INSERT INTO carbon_ledger
       (device_id, period_start, period_end, solar_kwh, co2_avoided_kg, credits_earned)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT DO NOTHING`,
    [
      deviceId,
      periodStart.toISOString(),
      periodEnd.toISOString(),
      summary.solar_kwh,
      summary.co2_avoided_kg,
      summary.credits_earned,
    ],
  );
}

/**
 * Environmental equivalences for the impact screen.
 */
export function computeImpactEquivalences(co2AvoidedKg: number) {
  return {
    trees_equivalent: Math.round(co2AvoidedKg / 21),        // 1 tree absorbs ~21 kg CO2/yr
    car_km_equivalent: Math.round(co2AvoidedKg / 0.1),      // 0.1 kg CO2 per km
    flight_pct_lagos_london: Math.round((co2AvoidedKg / 1000) * 100), // LOS-LHR ~1t CO2
    co2_weight_kg: Math.round(co2AvoidedKg),
  };
}

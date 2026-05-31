import { query } from '../db/index.js';
import { config } from '../config.js';
import type { AlertResult, AlertType, EnergySource } from '../types/index.js';

// ---- Solar forecast mock (real API: TODO replace with Open-Meteo) ----
function getMockedSolarForecast(): { tomorrowPeakHours: number; goodConditions: boolean } {
  // Deterministic "tomorrow" mock — varies by day of month for demo variety
  const dayOfMonth = new Date().getDate();
  const goodConditions = dayOfMonth % 3 !== 0; // roughly 2/3 days "good"
  return { tomorrowPeakHours: goodConditions ? 6 : 2, goodConditions };
}

/**
 * Evaluate alert rules against recent readings for a device.
 * Returns up to 3 alerts, ranked by estimated Naira impact.
 */
export async function evaluateAlerts(deviceId: string): Promise<AlertResult[]> {
  const candidates: AlertResult[] = [];

  // ---- Rule 1: Generator at low load (<30%) for >2 hours ----
  const genLowLoadResult = await query<{
    avg_power_kw: string;
    max_power_kw: string;
    hour_count: string;
  }>(
    `SELECT
       AVG(power_kw)::numeric(10,3)   AS avg_power_kw,
       MAX(power_kw)::numeric(10,3)   AS max_power_kw,
       COUNT(DISTINCT EXTRACT(HOUR FROM timestamp)) AS hour_count
     FROM readings
     WHERE device_id = $1
       AND source = 'generator'
       AND timestamp >= NOW() - INTERVAL '4 hours'`,
    [deviceId],
  );

  const genRow = genLowLoadResult.rows[0];
  if (genRow && parseFloat(genRow.avg_power_kw) > 0) {
    const avgKw = parseFloat(genRow.avg_power_kw);
    const maxKw = parseFloat(genRow.max_power_kw);
    const hoursCount = parseFloat(genRow.hour_count);

    // Low load = running at <30% of apparent rated capacity
    const loadFactor = maxKw > 0 ? avgKw / maxKw : 0;

    if (loadFactor < 0.3 && hoursCount >= 2) {
      // Fuel waste estimate: low-load generators use ~70% fuel for 30% power
      // Savings ≈ running at proper load or sharing load
      const hourlyWaste = avgKw * config.TARIFF_GENERATOR_NGN_KWH * 0.4;
      const impactNaira = hourlyWaste * hoursCount;

      candidates.push({
        alert_type: 'low_load_generator' as AlertType,
        message: `Generator running at ${Math.round(loadFactor * 100)}% load for ${Math.round(hoursCount)} hours`,
        impact_naira: Math.round(impactNaira),
        recommendation: 'Reduce generator capacity or coordinate load sharing with neighbours to cut fuel waste',
      });
    }
  }

  // ---- Rule 2: Good solar tomorrow — schedule high-load tasks ----
  const forecast = getMockedSolarForecast();
  if (forecast.goodConditions) {
    // High-consumption tasks during solar hours = zero marginal cost
    // Estimate: 2kWh of tasks shifted from generator to solar
    const shiftedKwh = 2;
    const impactNaira = shiftedKwh * config.TARIFF_GENERATOR_NGN_KWH;

    candidates.push({
      alert_type: 'solar_forecast' as AlertType,
      message: `Good solar conditions forecast tomorrow — ${forecast.tomorrowPeakHours} peak hours expected`,
      impact_naira: Math.round(impactNaira),
      recommendation: 'Schedule water heating, laundry, and heavy appliances between 10am–4pm tomorrow',
    });
  }

  // ---- Rule 3: High-consumption peak in last hour ----
  const highConsumptionResult = await query<{
    total_kwh: string;
    generator_kwh: string;
  }>(
    `SELECT
       SUM(energy_kwh)::numeric(10,4)                                       AS total_kwh,
       SUM(CASE WHEN source = 'generator' THEN energy_kwh ELSE 0 END)::numeric(10,4) AS generator_kwh
     FROM readings
     WHERE device_id = $1
       AND timestamp >= NOW() - INTERVAL '1 hour'`,
    [deviceId],
  );

  const highRow = highConsumptionResult.rows[0];
  if (highRow && parseFloat(highRow.total_kwh) > 2) {
    const totalKwh = parseFloat(highRow.total_kwh);
    const genKwh = parseFloat(highRow.generator_kwh);

    if (genKwh / totalKwh > 0.7) {
      // High generator dependency — water heater shift can help
      const waterHeaterKwh = 1.5; // typical 1.5 kWh/hr
      const monthlyImpact = waterHeaterKwh * config.TARIFF_GENERATOR_NGN_KWH * 30;

      candidates.push({
        alert_type: 'high_consumption' as AlertType,
        message: `${Math.round((genKwh / totalKwh) * 100)}% of your energy in the last hour came from the generator`,
        impact_naira: Math.round(monthlyImpact),
        recommendation: 'Shift water heating to early morning solar hours to save up to ₦' + monthlyImpact.toLocaleString('en-NG') + '/month',
      });
    }
  }

  // ---- Rank by impact, cap at 3 ----
  return candidates
    .sort((a, b) => b.impact_naira - a.impact_naira)
    .slice(0, 3);
}

/**
 * Pure-function alert evaluation (for unit testing without DB).
 * Accepts pre-fetched readings directly.
 */
export function evaluateAlertsFromReadings(
  readings: Array<{ source: EnergySource; power_kw: number; energy_kwh: number; hours_ago: number }>,
): AlertResult[] {
  const candidates: AlertResult[] = [];

  // Rule 1: Low load
  const genReadings = readings.filter(
    (r) => r.source === 'generator' && r.hours_ago <= 4,
  );

  if (genReadings.length > 0) {
    const avgKw = genReadings.reduce((s, r) => s + r.power_kw, 0) / genReadings.length;
    const maxKw = Math.max(...genReadings.map((r) => r.power_kw));
    const loadFactor = maxKw > 0 ? avgKw / maxKw : 0;

    if (loadFactor < 0.3 && genReadings.length >= 4) {
      const impactNaira = avgKw * config.TARIFF_GENERATOR_NGN_KWH * 0.4 * 4;
      candidates.push({
        alert_type: 'low_load_generator',
        message: `Generator running at ${Math.round(loadFactor * 100)}% load for 4 hours`,
        impact_naira: Math.round(impactNaira),
        recommendation: 'Reduce generator capacity or share load with neighbours',
      });
    }
  }

  return candidates.sort((a, b) => b.impact_naira - a.impact_naira).slice(0, 3);
}

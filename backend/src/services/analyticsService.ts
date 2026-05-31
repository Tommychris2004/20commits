import { query } from '../db/index.js';
import { config } from '../config.js';
import type {
  CostBreakdown,
  DailyCostRecord,
  HourlyRecord,
  EnergySource,
} from '../types/index.js';

// ---- Cost rates (NGN/kWh) ----
const RATES: Record<EnergySource, number> = {
  generator: config.TARIFF_GENERATOR_NGN_KWH,
  solar: config.TARIFF_SOLAR_NGN_KWH,
  grid: config.TARIFF_GRID_NGN_KWH,
};

// Generator-only baseline cost per kWh (for savings calculation)
const GENERATOR_BASELINE_RATE = config.TARIFF_GENERATOR_NGN_KWH;

/**
 * Compute cost breakdown for a set of energy readings.
 * Pure function — testable without database access.
 */
export function computeCostBreakdown(
  readings: Array<{ source: EnergySource; energy_kwh: number }>,
): CostBreakdown {
  const bySource = new Map<EnergySource, { kwh: number; cost: number }>();

  for (const { source, energy_kwh } of readings) {
    const prev = bySource.get(source) ?? { kwh: 0, cost: 0 };
    const cost = energy_kwh * RATES[source];
    bySource.set(source, { kwh: prev.kwh + energy_kwh, cost: prev.cost + cost });
  }

  const totalKwh = [...bySource.values()].reduce((s, v) => s + v.kwh, 0);
  const totalCost = [...bySource.values()].reduce((s, v) => s + v.cost, 0);

  // Savings = what it would have cost if 100% generator
  const baselineCost = totalKwh * GENERATOR_BASELINE_RATE;
  const savingsNaira = Math.max(0, baselineCost - totalCost);

  const blendedRate = totalKwh > 0 ? totalCost / totalKwh : 0;

  const bySourceResult = (['generator', 'solar', 'grid'] as EnergySource[]).map((src) => ({
    source: src,
    kwh: bySource.get(src)?.kwh ?? 0,
    cost_naira: bySource.get(src)?.cost ?? 0,
  }));

  return {
    total_kwh: totalKwh,
    total_cost_naira: totalCost,
    by_source: bySourceResult,
    savings_naira: savingsNaira,
    blended_rate_naira_per_kwh: blendedRate,
  };
}

/**
 * Fetch today's energy summary for a device from the database.
 */
export async function getTodaySummary(deviceId: string): Promise<{
  current_power_kw: number;
  breakdown: CostBreakdown;
  projected_monthly_cost_naira: number;
}> {
  // Current power: most recent reading per source (last 5 minutes)
  const latestResult = await query<{ source: EnergySource; power_kw: string }>(
    `SELECT source, power_kw
     FROM readings
     WHERE device_id = $1
       AND timestamp >= NOW() - INTERVAL '5 minutes'
     ORDER BY timestamp DESC
     LIMIT 6`,
    [deviceId],
  );

  const latestBySource = new Map<EnergySource, number>();
  for (const row of latestResult.rows) {
    if (!latestBySource.has(row.source)) {
      latestBySource.set(row.source, parseFloat(row.power_kw));
    }
  }
  const currentPowerKw = [...latestBySource.values()].reduce((s, v) => s + v, 0);

  // Today's readings
  const todayResult = await query<{ source: EnergySource; energy_kwh: string }>(
    `SELECT source, energy_kwh
     FROM readings
     WHERE device_id = $1
       AND timestamp >= NOW()::date
     ORDER BY timestamp`,
    [deviceId],
  );

  const readings = todayResult.rows.map((r) => ({
    source: r.source,
    energy_kwh: parseFloat(r.energy_kwh),
  }));

  const breakdown = computeCostBreakdown(readings);

  // Project to monthly: scale today's cost based on hours elapsed
  const hoursElapsed = new Date().getHours() + new Date().getMinutes() / 60 || 1;
  const projectedMonthlyCost = (breakdown.total_cost_naira / hoursElapsed) * 24 * 30;

  return {
    current_power_kw: currentPowerKw,
    breakdown,
    projected_monthly_cost_naira: projectedMonthlyCost,
  };
}

/**
 * 7-day daily cost history for a device.
 */
export async function getWeeklyHistory(deviceId: string): Promise<DailyCostRecord[]> {
  const result = await query<{
    date: string;
    source: EnergySource;
    total_kwh: string;
  }>(
    `SELECT
       to_char(time_bucket('1 day', timestamp), 'YYYY-MM-DD') AS date,
       source,
       SUM(energy_kwh) AS total_kwh
     FROM readings
     WHERE device_id = $1
       AND timestamp >= NOW() - INTERVAL '7 days'
     GROUP BY date, source
     ORDER BY date, source`,
    [deviceId],
  );

  // Aggregate into daily records
  const days = new Map<string, DailyCostRecord>();

  for (const row of result.rows) {
    const existing = days.get(row.date) ?? {
      date: row.date,
      total_kwh: 0,
      total_cost_naira: 0,
      by_source: { generator: 0, solar: 0, grid: 0 },
    };

    const kwh = parseFloat(row.total_kwh);
    existing.total_kwh += kwh;
    existing.total_cost_naira += kwh * RATES[row.source];
    existing.by_source[row.source] = kwh;

    days.set(row.date, existing);
  }

  // Fill missing days with zeros
  const records: DailyCostRecord[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    records.push(
      days.get(key) ?? {
        date: key,
        total_kwh: 0,
        total_cost_naira: 0,
        by_source: { generator: 0, solar: 0, grid: 0 },
      },
    );
  }

  return records;
}

/**
 * Hourly energy draw for today.
 */
export async function getHourlyToday(deviceId: string): Promise<HourlyRecord[]> {
  const result = await query<{
    hour: number;
    total_kwh: string;
  }>(
    `SELECT
       EXTRACT(HOUR FROM timestamp)::int AS hour,
       SUM(energy_kwh) AS total_kwh
     FROM readings
     WHERE device_id = $1
       AND timestamp >= NOW()::date
     GROUP BY hour
     ORDER BY hour`,
    [deviceId],
  );

  const byHour = new Map<number, number>();
  for (const row of result.rows) {
    byHour.set(row.hour, parseFloat(row.total_kwh));
  }

  return Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    total_kwh: byHour.get(h) ?? 0,
    source: 'mixed' as const,
  }));
}

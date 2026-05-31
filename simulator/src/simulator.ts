/**
 * GridNode Smart Node Simulator
 * ==============================
 * Pretends to be a physical Smart Node in a Nigerian home.
 * Generates realistic generator/solar/grid readings with a daily pattern.
 *
 * ALL DATA IS SIMULATED TEST DATA — not from any real device.
 */

import 'dotenv/config';

const API_BASE = process.env.API_BASE ?? 'http://localhost:3000';
const DEVICE_ID = process.env.DEVICE_ID ?? ''; // UUID from POST /api/devices/register
const API_TOKEN = process.env.API_TOKEN ?? ''; // JWT access token
const INTERVAL_MS = parseInt(process.env.INTERVAL_MS ?? '5000'); // default 5s
const HOME_NAME = process.env.HOME_NAME ?? 'Simulated Home';

interface Reading {
  device_id: string;
  timestamp: string;
  source: 'generator' | 'solar' | 'grid';
  power_kw: number;
  energy_kwh: number;
  is_simulated: true;
}

// ---- Nigerian electricity demand pattern ----
// hour → baseline load multiplier (0..1)
const HOURLY_MULTIPLIER: Record<number, number> = {
  0: 0.3, 1: 0.25, 2: 0.2, 3: 0.2, 4: 0.2, 5: 0.25,
  6: 0.5, 7: 0.7, 8: 0.8, 9: 0.75, 10: 0.7, 11: 0.65,
  12: 0.7, 13: 0.75, 14: 0.7, 15: 0.65, 16: 0.7, 17: 0.85,
  18: 1.0, 19: 0.95, 20: 0.9, 21: 0.8, 22: 0.6, 23: 0.4,
};

// System capacity (realistic 3kWp residential + 2.5kW generator)
const SOLAR_CAPACITY_KW = 3.0;
const GENERATOR_CAPACITY_KW = 2.5;
const GRID_MAX_KW = 1.5;

function isSolarHour(hour: number): boolean {
  return hour >= 7 && hour <= 18;
}

function solarIntensity(hour: number): number {
  if (!isSolarHour(hour)) return 0;
  // Bell curve peak at 13:00
  const peak = 13;
  const sigma = 3;
  return Math.exp(-0.5 * Math.pow((hour - peak) / sigma, 2));
}

function jitter(value: number, pct = 0.1): number {
  return value * (1 + (Math.random() - 0.5) * 2 * pct);
}

interface SourceReadings {
  generator: number;
  solar: number;
  grid: number;
}

function generateReadings(now: Date): SourceReadings {
  const hour = now.getHours();
  const loadMultiplier = HOURLY_MULTIPLIER[hour] ?? 0.5;
  const totalLoad = jitter(loadMultiplier * (SOLAR_CAPACITY_KW + GENERATOR_CAPACITY_KW), 0.15);

  const solarKw = Math.min(
    jitter(solarIntensity(hour) * SOLAR_CAPACITY_KW, 0.2),
    totalLoad,
  );

  const remaining = Math.max(0, totalLoad - solarKw);

  // Grid available sometimes (realistic PHCN/distribution): roughly 40% of time
  const gridAvailable = Math.random() < 0.4;
  const gridKw = gridAvailable ? Math.min(jitter(GRID_MAX_KW, 0.3), remaining) : 0;

  const generatorKw = Math.max(0, remaining - gridKw);

  return {
    generator: Math.min(generatorKw, GENERATOR_CAPACITY_KW),
    solar: solarKw,
    grid: gridKw,
  };
}

function buildReadings(deviceId: string, sources: SourceReadings, intervalSeconds: number): Reading[] {
  const now = new Date().toISOString();
  const kwhFactor = intervalSeconds / 3600; // W × h = Wh → kWh

  return (['generator', 'solar', 'grid'] as const)
    .filter((src) => sources[src] > 0.001)
    .map((src) => ({
      device_id: deviceId,
      timestamp: now,
      source: src,
      power_kw: Math.round(sources[src] * 1000) / 1000,
      energy_kwh: Math.round(sources[src] * kwhFactor * 10000) / 10000,
      is_simulated: true as const,
    }));
}

async function sendBatch(readings: Reading[]): Promise<void> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (API_TOKEN) headers['Authorization'] = `Bearer ${API_TOKEN}`;

  const res = await fetch(`${API_BASE}/api/ingest/batch`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ readings }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Ingest failed ${res.status}: ${body}`);
  }
}

function printReading(home: string, sources: SourceReadings): void {
  const hour = new Date().getHours();
  const time = new Date().toLocaleTimeString('en-NG', { timeStyle: 'medium' });
  const total = sources.generator + sources.solar + sources.grid;

  console.log(
    `[SIMULATED] ${home} @ ${time} | ` +
      `Total: ${total.toFixed(2)}kW | ` +
      `Gen: ${sources.generator.toFixed(2)}kW | ` +
      `Solar: ${sources.solar.toFixed(2)}kW (${isSolarHour(hour) ? 'sunny' : 'night'}) | ` +
      `Grid: ${sources.grid.toFixed(2)}kW`,
  );
}

async function tick(): Promise<void> {
  const now = new Date();
  const sources = generateReadings(now);

  printReading(HOME_NAME, sources);

  if (!DEVICE_ID) {
    console.warn('[simulator] DEVICE_ID not set — printing only, not sending to API');
    return;
  }

  const readings = buildReadings(DEVICE_ID, sources, INTERVAL_MS / 1000);
  try {
    await sendBatch(readings);
  } catch (err) {
    console.error('[simulator] Failed to send reading:', err instanceof Error ? err.message : err);
    // Store-and-forward would buffer here for real devices
  }
}

console.log(`
╔══════════════════════════════════════════════════╗
║    GridNode Smart Node Simulator                 ║
║    ⚠️  ALL DATA IS SIMULATED TEST DATA           ║
║    No real device. No real energy.               ║
╚══════════════════════════════════════════════════╝
Home: ${HOME_NAME}
Device ID: ${DEVICE_ID || '(not set — print only mode)'}
Target: ${API_BASE}
Interval: ${INTERVAL_MS / 1000}s
`);

await tick();
setInterval(tick, INTERVAL_MS);

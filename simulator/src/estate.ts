/**
 * Estate Simulator — spins up 5 simulated homes simultaneously.
 * ⚠️ ALL DATA IS SIMULATED TEST DATA
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const HOMES = [
  { name: 'Block A - Flat 1', deviceId: process.env.DEVICE_ID_1 ?? '' },
  { name: 'Block A - Flat 3', deviceId: process.env.DEVICE_ID_2 ?? '' },
  { name: 'Block B - Flat 7', deviceId: process.env.DEVICE_ID_3 ?? '' },
  { name: 'Block C - Flat 12', deviceId: process.env.DEVICE_ID_4 ?? '' },
  { name: 'Block D - Flat 18', deviceId: process.env.DEVICE_ID_5 ?? '' },
];

console.log(`
╔══════════════════════════════════════════════════╗
║    GridNode Estate Simulator (5 homes)           ║
║    ⚠️  ALL DATA IS SIMULATED TEST DATA           ║
╚══════════════════════════════════════════════════╝
`);

for (const home of HOMES) {
  const child = spawn(
    'node',
    ['--loader', 'tsx', path.join(__dirname, 'simulator.ts')],
    {
      env: {
        ...process.env,
        HOME_NAME: home.name,
        DEVICE_ID: home.deviceId,
        INTERVAL_MS: '8000', // stagger readings slightly
      },
      stdio: 'inherit',
    },
  );

  child.on('error', (err) => {
    console.error(`[estate] ${home.name} error:`, err.message);
  });

  console.log(`  ▶ Started: ${home.name}`);
}

import { Router } from 'express';
import { z } from 'zod';
import { query, withTransaction } from '../db/index.js';
import { validate } from '../middleware/validate.js';
import { BadRequestError, NotFoundError } from '../middleware/errorHandler.js';

export const ingestRouter = Router();

// Schema for a single reading
const readingSchema = z.object({
  device_id: z.string().uuid(),
  timestamp: z.string().datetime({ offset: true }).optional(),
  source: z.enum(['generator', 'solar', 'grid']),
  power_kw: z.number().nonnegative().max(1000),
  energy_kwh: z.number().nonnegative().max(10000),
  is_simulated: z.boolean().optional().default(false),
});

const batchSchema = z.object({
  readings: z.array(readingSchema).min(1).max(500),
});

async function insertReading(
  client: { query: (sql: string, params?: unknown[]) => Promise<{ rowCount: number | null }> },
  reading: z.infer<typeof readingSchema>,
): Promise<void> {
  await client.query(
    `INSERT INTO readings (device_id, timestamp, source, power_kw, energy_kwh, is_simulated)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      reading.device_id,
      reading.timestamp ?? new Date().toISOString(),
      reading.source,
      reading.power_kw,
      reading.energy_kwh,
      reading.is_simulated,
    ],
  );

  // Update device last_seen + status
  await client.query(
    `UPDATE devices SET status = 'online', last_seen = NOW()
     WHERE id = $1`,
    [reading.device_id],
  );
}

// POST /api/ingest — single reading
ingestRouter.post('/', validate(readingSchema), async (req, res, next) => {
  try {
    const reading = req.body as z.infer<typeof readingSchema>;

    // Verify device exists
    const deviceCheck = await query<{ id: string }>(
      'SELECT id FROM devices WHERE id = $1',
      [reading.device_id],
    );
    if (!deviceCheck.rowCount || deviceCheck.rowCount === 0) {
      throw new NotFoundError('Device');
    }

    await withTransaction(async (client) => insertReading(client, reading));

    res.status(201).json({ status: 'ok', ingested: 1 });
  } catch (err) {
    next(err);
  }
});

// POST /api/ingest/batch — store-and-forward batch
ingestRouter.post('/batch', validate(batchSchema), async (req, res, next) => {
  try {
    const { readings } = req.body as z.infer<typeof batchSchema>;

    // Verify all device_ids exist (unique set)
    const deviceIds = [...new Set(readings.map((r) => r.device_id))];
    const placeholders = deviceIds.map((_, i) => `$${i + 1}`).join(',');
    const deviceCheck = await query<{ id: string }>(
      `SELECT id FROM devices WHERE id IN (${placeholders})`,
      deviceIds,
    );

    const validIds = new Set(deviceCheck.rows.map((r) => r.id));
    const invalid = deviceIds.filter((id) => !validIds.has(id));
    if (invalid.length > 0) {
      throw new BadRequestError(`Unknown device IDs: ${invalid.join(', ')}`);
    }

    let ingested = 0;
    await withTransaction(async (client) => {
      for (const reading of readings) {
        await insertReading(client, reading);
        ingested++;
      }
    });

    res.status(201).json({ status: 'ok', ingested });
  } catch (err) {
    next(err);
  }
});

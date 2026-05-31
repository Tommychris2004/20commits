import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { query } from '../db/index.js';
import { validate } from '../middleware/validate.js';
import { ConflictError, NotFoundError } from '../middleware/errorHandler.js';
import type { DeviceRow } from '../types/index.js';

export const devicesRouter = Router();

devicesRouter.use(requireAuth);

// GET /api/devices
devicesRouter.get('/', async (req, res, next) => {
  try {
    const result = await query<DeviceRow>(
      `SELECT * FROM devices WHERE user_id = $1 ORDER BY created_at`,
      [req.user!.sub],
    );
    res.json({ devices: result.rows });
  } catch (err) {
    next(err);
  }
});

const registerSchema = z.object({
  node_id: z
    .string()
    .length(8, 'Node ID must be 8 characters')
    .regex(/^[A-Z0-9]+$/, 'Node ID must be uppercase alphanumeric'),
  name: z.string().max(100).optional(),
  location: z.string().max(200).optional(),
});

// POST /api/devices/register
devicesRouter.post('/register', validate(registerSchema), async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const { node_id, name, location } = req.body as z.infer<typeof registerSchema>;

    const existing = await query<{ id: string }>(
      `SELECT id FROM devices WHERE node_id = $1`,
      [node_id],
    );

    if (existing.rowCount && existing.rowCount > 0) {
      const device = existing.rows[0];
      // Check if already claimed by another user
      const claimed = await query<{ user_id: string | null }>(
        `SELECT user_id FROM devices WHERE id = $1`,
        [device.id],
      );
      if (claimed.rows[0]?.user_id && claimed.rows[0].user_id !== userId) {
        throw new ConflictError('This Node ID is already registered to another account');
      }
      // Re-register (claim unclaimed device)
      await query(
        `UPDATE devices SET user_id = $1, name = $2, location = $3, estate_id = $4
         WHERE id = $5`,
        [userId, name ?? null, location ?? null, req.user!.estateId ?? null, device.id],
      );
      const updated = await query<DeviceRow>(`SELECT * FROM devices WHERE id = $1`, [device.id]);
      res.json({ device: updated.rows[0], message: 'Device registered to your account.' });
      return;
    }

    const result = await query<DeviceRow>(
      `INSERT INTO devices (node_id, user_id, estate_id, name, location)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [node_id, userId, req.user!.estateId ?? null, name ?? null, location ?? null],
    );

    res.status(201).json({ device: result.rows[0], message: 'Smart Node registered successfully.' });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/devices/:id
devicesRouter.delete('/:id', async (req, res, next) => {
  try {
    const result = await query(
      `UPDATE devices SET user_id = NULL, status = 'not_connected'
       WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user!.sub],
    );
    if (!result.rowCount || result.rowCount === 0) throw new NotFoundError('Device');
    res.json({ status: 'ok' });
  } catch (err) {
    next(err);
  }
});

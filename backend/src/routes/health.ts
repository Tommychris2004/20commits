import { Router } from 'express';
import { pool } from '../db/index.js';

export const healthRouter = Router();

healthRouter.get('/', async (_req, res) => {
  try {
    const start = Date.now();
    await pool.query('SELECT 1');
    const dbMs = Date.now() - start;

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      db: { status: 'ok', latency_ms: dbMs },
      version: '1.0.0',
    });
  } catch {
    res.status(503).json({
      status: 'degraded',
      timestamp: new Date().toISOString(),
      db: { status: 'error' },
    });
  }
});

import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import { config } from './config.js';
import { checkDbConnection } from './db/index.js';
import { runMigrations } from './db/migrations.js';
import { errorHandler } from './middleware/errorHandler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIST = path.resolve(__dirname, '../../frontend/dist');

// Routes
import { healthRouter } from './routes/health.js';
import { authRouter } from './routes/auth.js';
import { ingestRouter } from './routes/ingest.js';
import { energyRouter } from './routes/energy.js';
import { analyticsRouter } from './routes/analytics.js';
import { alertsRouter } from './routes/alerts.js';
import { carbonRouter } from './routes/carbon.js';
import { estateRouter } from './routes/estate.js';
import { tradingRouter } from './routes/trading.js';
import { financingRouter } from './routes/financing.js';
import { devicesRouter } from './routes/devices.js';

const app = express();

// ---- Security headers ----
app.use(
  helmet({
    contentSecurityPolicy: false, // Vite assets use inline scripts in dev builds
  }),
);

// ---- CORS ----
const allowedOrigins = new Set([config.FRONTEND_ORIGIN, 'http://localhost:5173', 'http://localhost:3000']);
app.use(
  cors({
    origin: (origin, cb) => {
      // Same-origin or no-origin requests (curl, mobile apps) are always allowed
      if (!origin || allowedOrigins.has(origin) || origin.endsWith('.railway.app') || origin.endsWith('.up.railway.app')) {
        cb(null, true);
      } else {
        cb(null, false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

// ---- Body parsing ----
app.use(express.json({ limit: '1mb' }));

// ---- General rate limit ----
app.use(
  rateLimit({
    windowMs: config.RATE_LIMIT_WINDOW_MS,
    max: config.RATE_LIMIT_MAX_GENERAL,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message: 'Too many requests — slow down.' } },
  }),
);

// ---- Tighter rate limit for auth routes ----
const authLimiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_MAX_AUTH,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many auth requests.' } },
});

// ---- Routes ----
app.use('/api/health', healthRouter);
app.use('/api/auth', authLimiter, authRouter);
app.use('/api/ingest', ingestRouter);
app.use('/api/me/energy', energyRouter);
app.use('/api/me/history', analyticsRouter);
app.use('/api/me/alerts', alertsRouter);
app.use('/api/me/carbon', carbonRouter);
app.use('/api/me/financing', financingRouter);
app.use('/api/estate', estateRouter);
app.use('/api/trading', tradingRouter);
app.use('/api/devices', devicesRouter);

// ---- Serve frontend static files ----
if (fs.existsSync(FRONTEND_DIST)) {
  app.use(express.static(FRONTEND_DIST));
  // SPA fallback — all non-API routes serve index.html
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
  });
}

// ---- 404 handler (API routes only) ----
app.use((_req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Endpoint not found' } });
});

// ---- Central error handler (must be last) ----
app.use(errorHandler);

// ---- Boot ----
async function start(): Promise<void> {
  // Auto-migrate so Railway (and other platforms) need no separate migration step
  await runMigrations(false);
  app.listen(config.PORT, () => {
    console.info(`[server] GridNode API listening on port ${config.PORT} (${config.NODE_ENV})`);
  });
}

start().catch((err) => {
  console.error('[server] Fatal startup error:', err);
  process.exit(1);
});

export { app };

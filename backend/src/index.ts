import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import { config } from './config.js';
import { checkDbConnection } from './db/index.js';
import { errorHandler } from './middleware/errorHandler.js';

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
app.use(helmet());

// ---- CORS ----
app.use(
  cors({
    origin: config.FRONTEND_ORIGIN,
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

// ---- 404 handler ----
app.use((_req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Endpoint not found' } });
});

// ---- Central error handler (must be last) ----
app.use(errorHandler);

// ---- Boot ----
async function start(): Promise<void> {
  await checkDbConnection();
  app.listen(config.PORT, () => {
    console.info(`[server] GridNode API listening on port ${config.PORT} (${config.NODE_ENV})`);
  });
}

start().catch((err) => {
  console.error('[server] Fatal startup error:', err);
  process.exit(1);
});

export { app };

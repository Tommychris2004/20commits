import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  // Database
  DATABASE_URL: z.string().url().startsWith('postgres'),

  // JWT
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // CORS
  FRONTEND_ORIGIN: z.string().url().default('http://localhost:5173'),

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX_GENERAL: z.coerce.number().int().positive().default(100),
  RATE_LIMIT_MAX_AUTH: z.coerce.number().int().positive().default(20),

  // Carbon market
  CARBON_MARKET_PRICE_USD: z.coerce.number().positive().default(7.5),
  NGN_USD_RATE: z.coerce.number().positive().default(1580),
  GRIDNODE_CARBON_FEE_PCT: z.coerce.number().min(0).max(1).default(0.3),

  // Energy tariffs (NGN/kWh)
  TARIFF_GENERATOR_NGN_KWH: z.coerce.number().positive().default(450),
  TARIFF_SOLAR_NGN_KWH: z.coerce.number().nonnegative().default(0),
  TARIFF_GRID_NGN_KWH: z.coerce.number().positive().default(68),

  // CO2 emission factor
  CO2_FACTOR_KG_PER_KWH: z.coerce.number().positive().default(0.75),
});

const parsed = configSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌  Invalid environment configuration:');
  for (const issue of parsed.error.issues) {
    console.error(`   ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

export const config = parsed.data;

export type Config = typeof config;

/**
 * GridNode DDL — run once to initialise the schema.
 *
 * Usage:  npm run migrate
 *
 * Idempotent: every statement uses IF NOT EXISTS / OR REPLACE where possible
 * so it is safe to re-run without data loss.
 */

import { pool, checkDbConnection } from './index.js';

const DDL = /* sql */ `
-- ----------------------------------------------------------------
-- Extensions
-- ----------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
-- TimescaleDB loaded only when available (optional — plain PostgreSQL works for dev/small scale)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'timescaledb') THEN
    EXECUTE 'CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE';
  END IF;
END$$;

-- ----------------------------------------------------------------
-- estates (multi-tenant)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS estates (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  location    TEXT        NOT NULL,
  state       TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- users
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  estate_id     UUID        REFERENCES estates(id) ON DELETE SET NULL,
  email         TEXT        UNIQUE NOT NULL,
  password_hash TEXT        NOT NULL,
  name          TEXT        NOT NULL,
  role          TEXT        NOT NULL DEFAULT 'resident'
                            CHECK (role IN ('resident','estate_manager','admin')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_estate_id ON users(estate_id);
CREATE INDEX IF NOT EXISTS idx_users_email     ON users(email);

-- ----------------------------------------------------------------
-- devices (Smart Nodes)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS devices (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id          TEXT        UNIQUE NOT NULL,
  estate_id        UUID        REFERENCES estates(id) ON DELETE SET NULL,
  user_id          UUID        REFERENCES users(id)   ON DELETE SET NULL,
  name             TEXT,
  location         TEXT,
  firmware_version TEXT        NOT NULL DEFAULT '1.0.0',
  status           TEXT        NOT NULL DEFAULT 'not_connected'
                               CHECK (status IN ('online','offline','not_connected')),
  last_seen        TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_devices_user_id   ON devices(user_id);
CREATE INDEX IF NOT EXISTS idx_devices_estate_id ON devices(estate_id);
CREATE INDEX IF NOT EXISTS idx_devices_node_id   ON devices(node_id);

-- ----------------------------------------------------------------
-- readings (plain PostgreSQL — TimescaleDB optional for scale)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS readings (
  id           BIGSERIAL   PRIMARY KEY,
  device_id    UUID        NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  timestamp    TIMESTAMPTZ NOT NULL,
  source       TEXT        NOT NULL CHECK (source IN ('generator','solar','grid')),
  power_kw     NUMERIC(10,3) NOT NULL CHECK (power_kw  >= 0),
  energy_kwh   NUMERIC(10,4) NOT NULL CHECK (energy_kwh >= 0),
  is_simulated BOOLEAN     NOT NULL DEFAULT false
);

-- Upgrade to hypertable if TimescaleDB is available (fully dynamic to avoid parse errors)
DO $$
DECLARE
  tsdb_installed boolean;
  already_hyper  boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'timescaledb') INTO tsdb_installed;
  IF tsdb_installed THEN
    EXECUTE $dyn$
      SELECT EXISTS(
        SELECT 1 FROM timescaledb_information.hypertables
        WHERE hypertable_name = 'readings'
      )
    $dyn$ INTO already_hyper;
    IF NOT already_hyper THEN
      PERFORM create_hypertable('readings', 'timestamp');
    END IF;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_readings_device_ts
  ON readings(device_id, timestamp DESC);

-- ----------------------------------------------------------------
-- alerts_log
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS alerts_log (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id    UUID        REFERENCES devices(id) ON DELETE SET NULL,
  user_id      UUID        REFERENCES users(id)   ON DELETE SET NULL,
  alert_type   TEXT        NOT NULL,
  message      TEXT        NOT NULL,
  impact_naira NUMERIC(12,2),
  dismissed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_user_id    ON alerts_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_device_id  ON alerts_log(device_id);

-- ----------------------------------------------------------------
-- carbon_ledger
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS carbon_ledger (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id       UUID        REFERENCES devices(id) ON DELETE SET NULL,
  period_start    TIMESTAMPTZ NOT NULL,
  period_end      TIMESTAMPTZ NOT NULL,
  solar_kwh       NUMERIC(12,4) NOT NULL DEFAULT 0,
  co2_avoided_kg  NUMERIC(12,4) NOT NULL DEFAULT 0,
  credits_earned  NUMERIC(12,6) NOT NULL DEFAULT 0,
  payout_naira    NUMERIC(12,2),
  status          TEXT        NOT NULL DEFAULT 'accumulating'
                              CHECK (status IN ('accumulating','verifying','issued','sold','paid')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_carbon_device_id ON carbon_ledger(device_id);

-- ----------------------------------------------------------------
-- trading_offers
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS trading_offers (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_device_id UUID        REFERENCES devices(id) ON DELETE SET NULL,
  estate_id        UUID        REFERENCES estates(id) ON DELETE SET NULL,
  price_per_kwh    NUMERIC(8,2)  NOT NULL,
  quantity_kwh     NUMERIC(10,4) NOT NULL,
  status           TEXT        NOT NULL DEFAULT 'active'
                               CHECK (status IN ('active','matched','expired','cancelled')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_trading_estate_id ON trading_offers(estate_id, status);

-- ----------------------------------------------------------------
-- financing_applications
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS financing_applications (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID        REFERENCES users(id) ON DELETE SET NULL,
  system_size_kw     NUMERIC(5,2)  NOT NULL,
  loan_amount_naira  NUMERIC(12,2) NOT NULL,
  term_months        INTEGER       NOT NULL,
  monthly_payment    NUMERIC(10,2) NOT NULL,
  status             TEXT        NOT NULL DEFAULT 'pending'
                                 CHECK (status IN ('pending','approved','rejected','disbursed')),
  submitted_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_financing_user_id ON financing_applications(user_id);

-- ----------------------------------------------------------------
-- energy_trades (completed P2P transactions)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS energy_trades (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id         UUID        REFERENCES trading_offers(id) ON DELETE SET NULL,
  buyer_user_id    UUID        REFERENCES users(id) ON DELETE SET NULL,
  seller_device_id UUID        REFERENCES devices(id) ON DELETE SET NULL,
  estate_id        UUID        REFERENCES estates(id) ON DELETE SET NULL,
  quantity_kwh     NUMERIC(10,4) NOT NULL,
  price_per_kwh    NUMERIC(8,2)  NOT NULL,
  gross_naira      NUMERIC(12,2) NOT NULL,
  commission_naira NUMERIC(12,2) NOT NULL,
  seller_naira     NUMERIC(12,2) NOT NULL,
  status           TEXT        NOT NULL DEFAULT 'completed'
                               CHECK (status IN ('completed','cancelled','disputed')),
  traded_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trades_buyer    ON energy_trades(buyer_user_id, traded_at DESC);
CREATE INDEX IF NOT EXISTS idx_trades_seller   ON energy_trades(seller_device_id, traded_at DESC);
CREATE INDEX IF NOT EXISTS idx_trades_estate   ON energy_trades(estate_id, traded_at DESC);
`;

export async function runMigrations(endPool = true): Promise<void> {
  console.info('[migrate] Checking database connection…');
  await checkDbConnection();

  console.info('[migrate] Running DDL…');
  await pool.query(DDL);

  console.info('[migrate] ✅  Schema up-to-date.');
  if (endPool) await pool.end();
}

// Run directly when executed as a script
if (process.argv[1] && process.argv[1].includes('migrations')) {
  runMigrations().catch((err) => {
    console.error('[migrate] ❌  Migration failed:', err);
    process.exit(1);
  });
}

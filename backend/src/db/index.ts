import pg from 'pg';
import { config } from '../config.js';

const { Pool } = pg;

// Singleton pool — shared across entire process lifetime
export const pool = new Pool({
  connectionString: config.DATABASE_URL,
  max: 20,                   // max connections in pool
  idleTimeoutMillis: 30_000, // close idle connections after 30s
  connectionTimeoutMillis: 5_000, // fail fast if can't get a connection
  ssl: config.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false,
});

pool.on('error', (err) => {
  console.error('[db] Unexpected pool error:', err.message);
});

/**
 * Execute a parameterized query. Acquires a connection from the pool,
 * runs the query, then releases it automatically.
 */
export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  sql: string,
  params?: unknown[],
): Promise<pg.QueryResult<T>> {
  const start = Date.now();
  const result = await pool.query<T>(sql, params);
  const duration = Date.now() - start;
  if (config.NODE_ENV === 'development') {
    console.debug(`[db] query (${duration}ms) rows=${result.rowCount}`);
  }
  return result;
}

/**
 * Execute multiple queries inside a single transaction.
 * Rolls back automatically on any error.
 */
export async function withTransaction<T>(
  fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** Verify connectivity at startup. */
export async function checkDbConnection(): Promise<void> {
  const res = await pool.query<{ now: Date }>('SELECT NOW() AS now');
  console.info(`[db] Connected. Server time: ${res.rows[0]?.now?.toISOString()}`);
}

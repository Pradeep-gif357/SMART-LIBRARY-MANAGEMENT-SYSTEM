import pg from 'pg';

const { Pool } = pg;

// One shared connection pool (kept on globalThis so Next.js hot-reload doesn't open new pools).
const globalForPg = globalThis;

export const pool =
  globalForPg.__libraryPool ||
  new Pool({
    connectionString: process.env.DATABASE_URL, // credentials come from .env, never from source code
    max: 10,
  });

if (process.env.NODE_ENV !== 'production') globalForPg.__libraryPool = pool;

export const query = (text, params) => pool.query(text, params);

/** Runs fn(client) inside BEGIN ... COMMIT; rolls back automatically if fn throws. */
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore rollback errors */
    }
    throw err;
  } finally {
    client.release();
  }
}

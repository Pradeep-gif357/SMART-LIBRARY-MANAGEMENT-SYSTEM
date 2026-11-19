// Runs tests/db-tests.sql against your database:  npm run test:db
// Safe: all test data lives inside a transaction that is rolled back at the end.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import pg from 'pg';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
dotenv.config({ path: '.env' });

if (!process.env.DATABASE_URL) {
  console.error('[ERROR] DATABASE_URL is not set. Run "npm run setup" first.');
  process.exit(1);
}

// split the SQL file: everything before the RESULT marker runs first, then we read the results ourselves
const raw = fs.readFileSync('tests/db-tests.sql', 'utf8');
const marker = raw.indexOf('-- ======================= RESULT');
const body = raw
  .slice(0, marker)
  .split('\n')
  .filter((line) => !line.startsWith('\\')) // drop psql-only meta commands (\set, \pset, \o)
  .join('\n');

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
try {
  await client.connect();
} catch (e) {
  console.error('[ERROR] Cannot connect to the database: ' + (e.message || e.code));
  console.error('Start it with "docker compose up -d" and run "npm run setup".');
  process.exit(1);
}

let failed = 0;
try {
  await client.query(body); // BEGIN; fixtures; tests (transaction stays open)
  const { rows } = await client.query(
    `SELECT test, passed, detail FROM test_results ORDER BY id`
  );
  console.log('\nDatabase tests\n' + '-'.repeat(70));
  for (const r of rows) {
    console.log(`${r.passed ? 'PASS' : 'FAIL'}  ${r.test}${r.passed ? '' : '   -> ' + r.detail}`);
    if (!r.passed) failed++;
  }
  console.log('-'.repeat(70));
  console.log(`${rows.length - failed} passed, ${failed} failed, ${rows.length} total\n`);
} catch (e) {
  failed++;
  console.error('[ERROR] ' + e.message);
  if (/relation .* does not exist|function .* does not exist/i.test(e.message)) {
    console.error('The tables are missing - run "npm run setup" first.');
  }
} finally {
  try { await client.query('ROLLBACK'); } catch { /* ignore */ }
  await client.end();
}
process.exit(failed ? 1 : 0);

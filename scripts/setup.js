// One-command database setup:  npm run setup
//   1. creates .env if it does not exist (with a random JWT secret)
//   2. waits for PostgreSQL to accept connections
//   3. runs db/schema.sql (RESETS all tables) and loads the sample data
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import { BOOKS } from '../db/seed-data.js';
import { embedDocument, bookText, toVectorLiteral } from '../lib/embedding.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);

function fail(msg) {
  console.error('\n[ERROR] ' + msg + '\n');
  process.exit(1);
}

// ---- 1. .env ---------------------------------------------------------
if (!fs.existsSync('.env')) {
  if (!fs.existsSync('.env.example')) fail('.env.example is missing - re-extract the project.');
  fs.writeFileSync('.env', fs.readFileSync('.env.example', 'utf8'));
  console.log('Created .env from .env.example');
}
let envText = fs.readFileSync('.env', 'utf8');
if (/^JWT_SECRET=(CHANGE_ME)?\s*$/m.test(envText)) {
  envText = envText.replace(/^JWT_SECRET=.*$/m, 'JWT_SECRET=' + crypto.randomBytes(32).toString('hex'));
  fs.writeFileSync('.env', envText);
  console.log('Generated a random JWT_SECRET in .env');
}
dotenv.config({ path: '.env' });
if (!process.env.DATABASE_URL) fail('DATABASE_URL is not set in .env');

// ---- 2. connect ------------------------------------------------------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function connect() {
  let lastError;
  for (let i = 1; i <= 30; i++) {
    const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
    try {
      await client.connect();
      return client;
    } catch (e) {
      lastError = e;
      if (e.code === '28P01') fail('PostgreSQL rejected the password in DATABASE_URL (.env).');
      if (i === 1) console.log('Waiting for the database to start (is "docker compose up -d" running?) ...');
      await sleep(2000);
    }
  }
  fail(
    'Could not connect to the database at ' +
      process.env.DATABASE_URL.replace(/:\/\/[^@]*@/, '://***@') +
      '\nReason: ' + (lastError && (lastError.message || lastError.code)) +
      '\n\nFix: start the database with  docker compose up -d  (Docker Desktop must be running), then run  npm run setup  again.'
  );
}

// ---- 3. schema + seed -------------------------------------------------
async function runSchema(client) {
  const file = process.env.SCHEMA_FILE || 'db/schema.sql';
  try {
    await client.query(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    if (/extension "vector"|type "vector"/i.test(e.message)) {
      fail(
        'Your PostgreSQL does not have the pgvector extension.\n' +
          'Easiest fix: use the Docker database from this project (docker compose up -d) - it already includes pgvector.\n' +
          'Original error: ' + e.message
      );
    }
    throw e;
  }
}

const DAY = `interval '1 day'`;

async function seed(client) {
  const catIds = new Map();
  const authorIds = new Map();
  const bookIds = new Map();

  for (const [code, title, authors, category, year, copies, description] of BOOKS) {
    if (!catIds.has(category)) {
      const r = await client.query('INSERT INTO categories (name) VALUES ($1) RETURNING category_id', [category]);
      catIds.set(category, r.rows[0].category_id);
    }
    const embedding = toVectorLiteral(embedDocument(bookText({ title, authors: authors.join(' '), category, description })));
    const b = await client.query(
      `INSERT INTO books (book_code, title, description, publication_year, category_id, total_copies, available_copies, embedding)
       VALUES ($1, $2, $3, $4, $5, $6, $6, $7::vector) RETURNING book_id`,
      [code, title, description, year, catIds.get(category), copies, embedding]
    );
    const bookId = b.rows[0].book_id;
    bookIds.set(title, bookId);
    for (const name of authors) {
      if (!authorIds.has(name)) {
        const a = await client.query('INSERT INTO authors (name) VALUES ($1) RETURNING author_id', [name]);
        authorIds.set(name, a.rows[0].author_id);
      }
      await client.query('INSERT INTO book_authors (book_id, author_id) VALUES ($1, $2)', [bookId, authorIds.get(name)]);
    }
  }

  const USERS = [
    ['Librarian Admin', 'librarian@library.com', 'Admin@123', 'librarian'],
    ['Demo Student', 'student@library.com', 'Student@123', 'student'],
    ['Aarav Sharma', 'aarav@library.com', 'Student@123', 'student'],
    ['Diya Patel', 'diya@library.com', 'Student@123', 'student'],
    ['Kabir Singh', 'kabir@library.com', 'Student@123', 'student'],
    ['Meera Nair', 'meera@library.com', 'Student@123', 'student'],
  ];
  const userIds = new Map();
  for (const [name, email, password, role] of USERS) {
    const r = await client.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING user_id',
      [name, email, bcrypt.hashSync(password, 10), role]
    );
    userIds.set(email, r.rows[0].user_id);
  }

  const bid = (title) => {
    if (!bookIds.has(title)) throw new Error('Seed refers to unknown book: ' + title);
    return bookIds.get(title);
  };
  const uid = (email) => userIds.get(email);

  const activity = (email, title, action, daysAgo, searchQuery = null) =>
    client.query(
      `INSERT INTO activity_log (user_id, book_id, action, search_query, created_at)
       VALUES ($1, $2, $3, $4, now() - ($5::numeric * ${DAY}))`,
      [uid(email), title ? bid(title) : null, action, searchQuery, daysAgo]
    );

  // loan(email, title, borrowedDaysAgo, returnedDaysAgo | null, fine)
  const loan = async (email, title, borrowedDaysAgo, returnedDaysAgo = null, fine = 0) => {
    await client.query(
      `INSERT INTO borrowings (user_id, book_id, borrowed_at, due_date, returned_at, fine_amount, status)
       VALUES ($1, $2,
               now() - ($3::numeric * ${DAY}),
               now() - ($3::numeric * ${DAY}) + interval '14 days',
               CASE WHEN $4::numeric IS NULL THEN NULL ELSE now() - ($4::numeric * ${DAY}) END,
               $5,
               CASE WHEN $4::numeric IS NULL THEN 'borrowed' ELSE 'returned' END)`,
      [uid(email), bid(title), borrowedDaysAgo, returnedDaysAgo, fine]
    );
    await activity(email, title, 'borrow', borrowedDaysAgo);
  };

  // Demo student: programming + AI interests
  await loan('student@library.com', 'Python Crash Course', 40, 30);
  await loan('student@library.com', 'Clean Code', 28, 18);
  await loan('student@library.com', 'Introduction to Algorithms', 20, 12);
  await loan('student@library.com', 'The Pragmatic Programmer', 3);
  await activity('student@library.com', 'Deep Learning', 'view', 2);
  await activity('student@library.com', 'Artificial Intelligence: A Modern Approach', 'view', 1.5);
  await activity('student@library.com', 'Mathematics for Machine Learning', 'view', 1);
  await activity('student@library.com', null, 'search', 1.2, 'machine learning');
  await activity('student@library.com', null, 'search', 0.8, 'neural networks python');

  // Other readers (give the recommender and the dashboard real data)
  await loan('aarav@library.com', 'Python Crash Course', 45, 38);
  await loan('aarav@library.com', 'Deep Learning', 35, 25);
  await loan('aarav@library.com', 'Artificial Intelligence: A Modern Approach', 24, 15);
  await loan('aarav@library.com', 'Mathematics for Machine Learning', 4);
  await activity('aarav@library.com', 'Introduction to Linear Algebra', 'view', 3);

  await loan('diya@library.com', 'Pride and Prejudice', 50, 40);
  await loan('diya@library.com', "Harry Potter and the Philosopher's Stone", 39, 30);
  await loan('diya@library.com', 'The Alchemist', 29, 22);
  await loan('diya@library.com', 'The Hobbit', 20); // overdue: due 6 days ago
  await activity('diya@library.com', 'Dune', 'view', 2);

  await loan('kabir@library.com', 'Atomic Habits', 45, 33);
  await loan('kabir@library.com', 'Deep Work', 32, 10, 16.0); // returned 8 days late
  await loan('kabir@library.com', 'Zero to One', 24, 16);
  await loan('kabir@library.com', 'Clean Code', 15, 9);
  await loan('kabir@library.com', 'Dune', 5); // Dune has 1 copy -> now unavailable (reservation demo)

  await loan('meera@library.com', 'Cosmos', 50, 41);
  await loan('meera@library.com', 'A Brief History of Time', 40, 32);
  await loan('meera@library.com', 'The Selfish Gene', 31, 24);
  await loan('meera@library.com', 'Sapiens: A Brief History of Humankind', 22, 14);
  await loan('meera@library.com', 'Foundation', 6);

  for (const [email, title, d] of [
    ['meera@library.com', 'Astrophysics for People in a Hurry', 2],
    ['kabir@library.com', 'The Lean Startup', 3],
    ['diya@library.com', 'Nineteen Eighty-Four', 4],
    ['aarav@library.com', 'Deep Learning', 1],
    ['aarav@library.com', 'Designing Data-Intensive Applications', 2],
  ]) {
    await activity(email, title, 'view', d);
  }
  await activity('aarav@library.com', null, 'search', 2, 'machine learning');
  await activity('meera@library.com', null, 'search', 3, 'space and universe');
  await activity('kabir@library.com', null, 'search', 4, 'startup');

  // a waiting reservation: Diya wants Dune (currently on loan)
  await client.query(
    `INSERT INTO reservations (user_id, book_id) VALUES ($1, $2)`,
    [uid('diya@library.com'), bid('Dune')]
  );
}

const client = await connect();
try {
  console.log('Creating tables, views, functions and triggers ...');
  await runSchema(client);
  console.log('Loading sample books, users and activity ...');
  await seed(client);
  const counts = await client.query(
    `SELECT (SELECT count(*) FROM books) AS books, (SELECT count(*) FROM users) AS users,
            (SELECT count(*) FROM borrowings) AS loans, (SELECT count(*) FROM activity_log) AS events`
  );
  const c = counts.rows[0];
  console.log(`\nDone. ${c.books} books, ${c.users} users, ${c.loans} loans, ${c.events} activity events.\n`);
  console.log('Login accounts:');
  console.log('  Librarian (admin):  librarian@library.com / Admin@123');
  console.log('  Student:            student@library.com   / Student@123');
  console.log('\nNext:  npm run dev   ->  open http://localhost:3000\n');
} catch (e) {
  console.error('\n[ERROR] Setup failed: ' + e.message + '\n');
  process.exitCode = 1;
} finally {
  await client.end();
}

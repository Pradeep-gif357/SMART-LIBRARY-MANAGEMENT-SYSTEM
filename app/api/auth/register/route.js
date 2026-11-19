import { query } from '@/lib/db.js';
import { createSession, hashPassword } from '@/lib/auth.js';
import { ApiError, handler, json, readJson } from '@/lib/api.js';

export const dynamic = 'force-dynamic';

export const POST = handler(async (request) => {
  const body = await readJson(request);
  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');

  if (name.length < 2 || name.length > 100) throw new ApiError('Please enter your name (2-100 characters)');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new ApiError('Please enter a valid email address');
  if (password.length < 8) throw new ApiError('Password must be at least 8 characters');

  const exists = await query('SELECT 1 FROM users WHERE email = $1', [email]);
  if (exists.rowCount > 0) throw new ApiError('This email is already registered', 409);

  // public sign-up always creates a student; librarians are promoted by an existing librarian
  const { rows } = await query(
    `INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, 'student')
     RETURNING user_id, name, email, role`,
    [name, email, await hashPassword(password)]
  );
  await createSession(rows[0].user_id);
  return json({ user: rows[0] }, 201);
});

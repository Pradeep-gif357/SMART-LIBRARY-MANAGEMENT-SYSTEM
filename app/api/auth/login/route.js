import { query } from '@/lib/db.js';
import { createSession, verifyPassword } from '@/lib/auth.js';
import { ApiError, handler, json, readJson } from '@/lib/api.js';

export const dynamic = 'force-dynamic';

export const POST = handler(async (request) => {
  const body = await readJson(request);
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');

  const { rows } = await query(
    'SELECT user_id, name, email, role, password_hash FROM users WHERE email = $1',
    [email]
  );
  const user = rows[0];
  // same message for "no such user" and "wrong password" so emails cannot be guessed
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    throw new ApiError('Incorrect email or password', 401);
  }

  await createSession(user.user_id);
  return json({ user: { user_id: user.user_id, name: user.name, email: user.email, role: user.role } });
});

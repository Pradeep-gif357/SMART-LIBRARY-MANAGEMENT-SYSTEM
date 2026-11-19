import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { query } from './db.js';

const COOKIE = 'session';

function secretKey() {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 16 || s === 'CHANGE_ME') {
    throw new Error('JWT_SECRET is missing. Run "npm run setup" (it creates .env) and restart the server.');
  }
  return new TextEncoder().encode(s);
}

export const hashPassword = (plain) => bcrypt.hash(plain, 10);
export const verifyPassword = (plain, hash) => bcrypt.compare(plain, hash);

export async function createSession(userId) {
  const token = await new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secretKey());

  cookies().set(COOKIE, token, {
    httpOnly: true, // not readable from browser JavaScript
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE === 'true',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
}

export function destroySession() {
  cookies().set(COOKIE, '', { path: '/', maxAge: 0 });
}

/** Returns { user_id, name, email, role } for the logged-in user, or null. */
export async function getSession() {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    const { rows } = await query('SELECT user_id, name, email, role FROM users WHERE user_id = $1', [payload.uid]);
    return rows[0] || null;
  } catch {
    return null;
  }
}

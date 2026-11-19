import { NextResponse } from 'next/server';
import { getSession } from './auth.js';

export class ApiError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export const json = (data, status = 200) => NextResponse.json(data, { status });

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    throw new ApiError('Invalid request body', 400);
  }
}

/** Throws 401/403 unless a user (optionally with the given role) is logged in. */
export async function requireUser(role) {
  const user = await getSession();
  if (!user) throw new ApiError('Please log in first', 401);
  if (role && user.role !== role) throw new ApiError('You do not have permission to do this', 403);
  return user;
}

const CONSTRAINT_MESSAGES = {
  users_email_key: 'This email is already registered',
  users_email_check: 'Please enter a valid email address',
  books_book_code_key: 'A book with this code already exists',
  uq_active_borrow: 'You already have this book borrowed',
  uq_active_reservation: 'You already reserved this book',
  chk_available_range: 'Total copies cannot be lower than the number of copies currently on loan',
  books_total_copies_check: 'Total copies cannot be negative',
  books_publication_year_check: 'Publication year must be between 1400 and 2100',
};

/** Wraps a route handler: turns thrown errors (including PostgreSQL errors) into clean JSON responses. */
export function handler(fn) {
  return async (request, ctx) => {
    try {
      return await fn(request, ctx);
    } catch (e) {
      if (e instanceof ApiError) return json({ error: e.message }, e.status);

      // PostgreSQL error codes
      if (e && e.code === 'P0001') return json({ error: e.message }, 400); // RAISE EXCEPTION from triggers/functions
      if (e && e.code === '23505') return json({ error: CONSTRAINT_MESSAGES[e.constraint] || 'This value already exists' }, 409);
      if (e && e.code === '23503') return json({ error: 'This record is linked to other data (for example loan history) and cannot be changed this way' }, 409);
      if (e && (e.code === '23514' || e.code === '23502' || e.code === '22001')) {
        return json({ error: CONSTRAINT_MESSAGES[e.constraint] || 'Some of the values are not valid' }, 400);
      }
      if (e && (e.code === 'ECONNREFUSED' || e.code === '28P01' || e.code === '3D000' || e.code === '57P03')) {
        return json({ error: 'Cannot reach the database. Make sure it is running ("docker compose up -d") and "npm run setup" has been run.' }, 503);
      }
      if (e && e.code === '42P01') {
        return json({ error: 'Database tables are missing. Run "npm run setup" first.' }, 503);
      }
      console.error(e);
      return json({ error: e?.message?.includes('JWT_SECRET') ? e.message : 'Something went wrong on the server' }, 500);
    }
  };
}

export const toInt = (v, fallback = NaN) => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
};

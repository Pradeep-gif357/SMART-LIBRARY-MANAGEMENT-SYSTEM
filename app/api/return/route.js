import { query, withTransaction } from '@/lib/db.js';
import { ApiError, handler, json, readJson, requireUser, toInt } from '@/lib/api.js';

export const dynamic = 'force-dynamic';

// POST /api/return { borrowingId }  - a student can return their own loan, a librarian any loan
export const POST = handler(async (request) => {
  const me = await requireUser();
  const body = await readJson(request);
  const borrowingId = toInt(body.borrowingId);
  if (!Number.isInteger(borrowingId)) throw new ApiError('borrowingId is required');

  const loan = await query('SELECT user_id FROM borrowings WHERE borrowing_id = $1', [borrowingId]);
  if (loan.rowCount === 0) throw new ApiError('Loan not found', 404);
  if (loan.rows[0].user_id !== me.user_id && me.role !== 'librarian') {
    throw new ApiError('You can only return your own books', 403);
  }

  const fine = await withTransaction(async (client) => {
    const r = await client.query('SELECT fn_return_book($1) AS fine', [borrowingId]);
    return Number(r.rows[0].fine);
  });
  return json({ ok: true, fine });
});

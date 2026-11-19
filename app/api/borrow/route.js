import { query, withTransaction } from '@/lib/db.js';
import { ApiError, handler, json, readJson, requireUser, toInt } from '@/lib/api.js';

export const dynamic = 'force-dynamic';

// POST /api/borrow { bookId }            -> student borrows for themselves
// POST /api/borrow { bookId, userId }    -> librarian issues a book to a student
export const POST = handler(async (request) => {
  const me = await requireUser();
  const body = await readJson(request);
  const bookId = toInt(body.bookId);
  if (!Number.isInteger(bookId)) throw new ApiError('bookId is required');

  let borrower = me.user_id;
  if (body.userId != null && body.userId !== '') {
    if (me.role !== 'librarian') throw new ApiError('Only librarians can issue books to other users', 403);
    borrower = toInt(body.userId);
    if (!Number.isInteger(borrower)) throw new ApiError('Invalid user');
  }

  // transaction: borrowing row + availability update (trigger) + activity log (function) succeed or fail together
  const borrowingId = await withTransaction(async (client) => {
    const r = await client.query('SELECT fn_borrow_book($1, $2) AS id', [borrower, bookId]);
    return r.rows[0].id;
  });

  const loan = await query('SELECT borrowing_id, due_date FROM borrowings WHERE borrowing_id = $1', [borrowingId]);
  return json(loan.rows[0], 201);
});

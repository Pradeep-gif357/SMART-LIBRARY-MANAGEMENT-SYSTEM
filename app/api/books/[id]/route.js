import { query, withTransaction } from '@/lib/db.js';
import { getSession } from '@/lib/auth.js';
import { ApiError, handler, json, readJson, requireUser, toInt } from '@/lib/api.js';
import { saveBook, validateBook } from '@/lib/books.js';

export const dynamic = 'force-dynamic';

export const GET = handler(async (request, { params }) => {
  const id = toInt(params.id);
  if (!Number.isInteger(id)) throw new ApiError('Book not found', 404);

  const { rows } = await query('SELECT * FROM v_book_catalog WHERE book_id = $1', [id]);
  if (rows.length === 0) throw new ApiError('Book not found', 404);
  const { search_tsv: _ignored, ...book } = rows[0];

  const user = await getSession();
  let myLoan = null;
  let myReservation = null;
  if (user) {
    // viewing a book is a recommendation signal
    try {
      await query(`INSERT INTO activity_log (user_id, book_id, action) VALUES ($1, $2, 'view')`, [user.user_id, id]);
    } catch {
      /* ignore */
    }
    myLoan = (
      await query(
        `SELECT borrowing_id, due_date FROM borrowings WHERE user_id = $1 AND book_id = $2 AND returned_at IS NULL`,
        [user.user_id, id]
      )
    ).rows[0] || null;
    myReservation = (
      await query(
        `SELECT reservation_id, status FROM reservations WHERE user_id = $1 AND book_id = $2 AND status IN ('active','ready')`,
        [user.user_id, id]
      )
    ).rows[0] || null;
  }

  // "More like this": nearest neighbours by embedding (pgvector)
  const similar = await query(
    `SELECT c.book_id, c.title, c.authors, c.category, c.available_copies, c.total_copies,
            ROUND((1 - (b.embedding <=> (SELECT embedding FROM books WHERE book_id = $1)))::numeric, 3) AS score
       FROM books b
       JOIN v_book_catalog c ON c.book_id = b.book_id
      WHERE b.book_id <> $1 AND b.embedding IS NOT NULL
      ORDER BY b.embedding <=> (SELECT embedding FROM books WHERE book_id = $1)
      LIMIT 4`,
    [id]
  );

  const queue = await query(
    `SELECT count(*)::int AS n FROM reservations WHERE book_id = $1 AND status IN ('active','ready')`,
    [id]
  );

  return json({ book, similar: similar.rows, myLoan, myReservation, waiting: queue.rows[0].n });
});

export const PUT = handler(async (request, { params }) => {
  await requireUser('librarian');
  const id = toInt(params.id);
  if (!Number.isInteger(id)) throw new ApiError('Book not found', 404);
  const data = validateBook(await readJson(request));
  await withTransaction((client) => saveBook(client, id, data));
  return json({ ok: true });
});

export const DELETE = handler(async (request, { params }) => {
  await requireUser('librarian');
  const id = toInt(params.id);
  if (!Number.isInteger(id)) throw new ApiError('Book not found', 404);

  const used = await query('SELECT 1 FROM borrowings WHERE book_id = $1 LIMIT 1', [id]);
  if (used.rowCount > 0) {
    throw new ApiError('This book has loan history and cannot be deleted. Set its total copies to 0 instead.', 409);
  }
  const r = await query('DELETE FROM books WHERE book_id = $1', [id]);
  if (r.rowCount === 0) throw new ApiError('Book not found', 404);
  return json({ ok: true });
});

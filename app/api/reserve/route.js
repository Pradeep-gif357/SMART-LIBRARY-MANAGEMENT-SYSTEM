import { query, withTransaction } from '@/lib/db.js';
import { ApiError, handler, json, readJson, requireUser, toInt } from '@/lib/api.js';

export const dynamic = 'force-dynamic';

// POST /api/reserve { bookId }  - only works while no copy is available (enforced by a trigger)
export const POST = handler(async (request) => {
  const me = await requireUser();
  const bookId = toInt((await readJson(request)).bookId);
  if (!Number.isInteger(bookId)) throw new ApiError('bookId is required');

  const id = await withTransaction(async (client) => {
    const r = await client.query(
      'INSERT INTO reservations (user_id, book_id) VALUES ($1, $2) RETURNING reservation_id',
      [me.user_id, bookId]
    );
    await client.query(`INSERT INTO activity_log (user_id, book_id, action) VALUES ($1, $2, 'reserve')`, [me.user_id, bookId]);
    return r.rows[0].reservation_id;
  });
  return json({ reservation_id: id }, 201);
});

// DELETE /api/reserve?id=123  - cancel my reservation
export const DELETE = handler(async (request) => {
  const me = await requireUser();
  const id = toInt(new URL(request.url).searchParams.get('id'));
  if (!Number.isInteger(id)) throw new ApiError('id is required');

  const r = await query(
    `UPDATE reservations SET status = 'cancelled'
      WHERE reservation_id = $1 AND user_id = $2 AND status IN ('active','ready')`,
    [id, me.user_id]
  );
  if (r.rowCount === 0) throw new ApiError('Reservation not found', 404);
  return json({ ok: true });
});

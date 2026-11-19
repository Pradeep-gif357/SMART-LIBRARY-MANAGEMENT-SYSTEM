import { query } from '@/lib/db.js';
import { handler, json, requireUser } from '@/lib/api.js';

export const dynamic = 'force-dynamic';

// Everything the "My Library" page needs
export const GET = handler(async () => {
  const me = await requireUser();

  const loans = await query(
    `SELECT br.borrowing_id, br.book_id, b.title, c.authors, br.borrowed_at, br.due_date, br.returned_at,
            br.fine_amount, br.status,
            (br.returned_at IS NULL AND br.due_date < now()) AS overdue,
            CASE WHEN br.returned_at IS NULL THEN fn_calc_fine(br.due_date, now()) ELSE br.fine_amount END AS current_fine
       FROM borrowings br
       JOIN books b ON b.book_id = br.book_id
       JOIN v_book_catalog c ON c.book_id = br.book_id
      WHERE br.user_id = $1
      ORDER BY br.returned_at IS NULL DESC, br.borrowed_at DESC`,
    [me.user_id]
  );

  const reservations = await query(
    `SELECT r.reservation_id, r.book_id, b.title, r.reserved_at, r.status, b.available_copies,
            (SELECT count(*)::int FROM reservations r2
              WHERE r2.book_id = r.book_id AND r2.status = 'active' AND r2.reserved_at <= r.reserved_at) AS queue_position
       FROM reservations r
       JOIN books b ON b.book_id = r.book_id
      WHERE r.user_id = $1 AND r.status IN ('active','ready')
      ORDER BY r.reserved_at`,
    [me.user_id]
  );

  const active = loans.rows.filter((l) => !l.returned_at);
  const history = loans.rows.filter((l) => l.returned_at);
  const finesOwed = active.reduce((s, l) => s + Number(l.current_fine), 0);
  const finesPaid = history.reduce((s, l) => s + Number(l.fine_amount), 0);

  return json({ active, history, reservations: reservations.rows, finesOwed, finesPaid });
});

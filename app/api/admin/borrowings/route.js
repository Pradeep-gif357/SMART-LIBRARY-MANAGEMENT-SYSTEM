import { query } from '@/lib/db.js';
import { handler, json, requireUser } from '@/lib/api.js';

export const dynamic = 'force-dynamic';

// GET /api/admin/borrowings?status=all|active|overdue|returned
export const GET = handler(async (request) => {
  await requireUser('librarian');
  const status = new URL(request.url).searchParams.get('status') || 'all';

  const filter =
    status === 'active' ? 'WHERE br.returned_at IS NULL'
    : status === 'overdue' ? 'WHERE br.returned_at IS NULL AND br.due_date < now()'
    : status === 'returned' ? 'WHERE br.returned_at IS NOT NULL'
    : '';

  const { rows } = await query(
    `SELECT br.borrowing_id, u.name AS user_name, u.email, b.title, br.borrowed_at, br.due_date, br.returned_at,
            br.status, (br.returned_at IS NULL AND br.due_date < now()) AS overdue,
            CASE WHEN br.returned_at IS NULL THEN fn_calc_fine(br.due_date, now()) ELSE br.fine_amount END AS fine
       FROM borrowings br
       JOIN users u ON u.user_id = br.user_id
       JOIN books b ON b.book_id = br.book_id
       ${filter}
      ORDER BY br.returned_at IS NULL DESC, br.borrowed_at DESC
      LIMIT 300`
  );
  return json({ borrowings: rows });
});

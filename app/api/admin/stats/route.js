import { query } from '@/lib/db.js';
import { handler, json, requireUser } from '@/lib/api.js';

export const dynamic = 'force-dynamic';

// Librarian dashboard numbers. Uses views, aggregates, GROUP BY / HAVING and subqueries.
export const GET = handler(async () => {
  await requireUser('librarian');

  const [totals, overdue, popular, categories, topReaders, trending, neverBorrowed] = await Promise.all([
    query(
      `SELECT (SELECT count(*)::int FROM books)                                           AS titles,
              (SELECT COALESCE(sum(total_copies), 0)::int FROM books)                     AS copies,
              (SELECT COALESCE(sum(available_copies), 0)::int FROM books)                 AS available_copies,
              (SELECT count(*)::int FROM users WHERE role = 'student')                    AS students,
              (SELECT count(*)::int FROM borrowings WHERE returned_at IS NULL)            AS active_loans,
              (SELECT count(*)::int FROM v_overdue_loans)                                 AS overdue_loans,
              (SELECT count(*)::int FROM reservations WHERE status IN ('active','ready')) AS open_reservations,
              (SELECT COALESCE(sum(fine_amount), 0)::float FROM borrowings)               AS fines_charged`
    ),
    query('SELECT * FROM v_overdue_loans ORDER BY days_overdue DESC LIMIT 10'),
    query('SELECT * FROM v_popular_books ORDER BY borrow_count DESC, view_count DESC, title LIMIT 5'),
    query('SELECT category, titles, total_loans FROM v_category_stats ORDER BY total_loans DESC, category'),
    query(
      `SELECT u.name, count(*)::int AS loans
         FROM borrowings br JOIN users u ON u.user_id = br.user_id
        GROUP BY u.user_id, u.name
       HAVING count(*) >= 2
        ORDER BY loans DESC, u.name LIMIT 5`
    ),
    query(
      `SELECT lower(search_query) AS term, count(*)::int AS searches
         FROM activity_log WHERE action = 'search'
        GROUP BY lower(search_query)
        ORDER BY searches DESC, term LIMIT 5`
    ),
    query(
      `SELECT book_id, title FROM books
        WHERE book_id NOT IN (SELECT book_id FROM borrowings)
        ORDER BY title LIMIT 8`
    ),
  ]);

  return json({
    totals: totals.rows[0],
    overdue: overdue.rows,
    popular: popular.rows,
    categories: categories.rows,
    topReaders: topReaders.rows,
    trending: trending.rows,
    neverBorrowed: neverBorrowed.rows,
  });
});

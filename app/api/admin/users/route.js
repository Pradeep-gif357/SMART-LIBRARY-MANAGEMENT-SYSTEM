import { query } from '@/lib/db.js';
import { ApiError, handler, json, readJson, requireUser, toInt } from '@/lib/api.js';

export const dynamic = 'force-dynamic';

export const GET = handler(async () => {
  await requireUser('librarian');
  const { rows } = await query(
    `SELECT u.user_id, u.name, u.email, u.role, u.created_at,
            count(br.borrowing_id)::int                                  AS total_loans,
            count(br.borrowing_id) FILTER (WHERE br.returned_at IS NULL) AS active_loans
       FROM users u
       LEFT JOIN borrowings br ON br.user_id = u.user_id
      GROUP BY u.user_id
      ORDER BY u.role DESC, u.name`
  );
  return json({ users: rows });
});

// PATCH { userId, role }  - promote/demote
export const PATCH = handler(async (request) => {
  const me = await requireUser('librarian');
  const body = await readJson(request);
  const userId = toInt(body.userId);
  const role = String(body.role || '');
  if (!Number.isInteger(userId)) throw new ApiError('userId is required');
  if (!['student', 'librarian'].includes(role)) throw new ApiError('Role must be student or librarian');
  if (userId === me.user_id) throw new ApiError('You cannot change your own role');

  const r = await query('UPDATE users SET role = $1 WHERE user_id = $2', [role, userId]);
  if (r.rowCount === 0) throw new ApiError('User not found', 404);
  return json({ ok: true });
});

// DELETE ?id=123
export const DELETE = handler(async (request) => {
  const me = await requireUser('librarian');
  const id = toInt(new URL(request.url).searchParams.get('id'));
  if (!Number.isInteger(id)) throw new ApiError('id is required');
  if (id === me.user_id) throw new ApiError('You cannot delete your own account');

  const open = await query('SELECT 1 FROM borrowings WHERE user_id = $1 AND returned_at IS NULL LIMIT 1', [id]);
  if (open.rowCount > 0) throw new ApiError('This user still has books on loan. Return them first.', 409);

  const r = await query('DELETE FROM users WHERE user_id = $1', [id]);
  if (r.rowCount === 0) throw new ApiError('User not found', 404);
  return json({ ok: true });
});

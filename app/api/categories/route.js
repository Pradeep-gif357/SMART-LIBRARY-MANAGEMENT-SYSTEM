import { query } from '@/lib/db.js';
import { handler, json } from '@/lib/api.js';

export const dynamic = 'force-dynamic';

export const GET = handler(async () => {
  const { rows } = await query('SELECT category_id, name FROM categories ORDER BY name');
  return json({ categories: rows });
});

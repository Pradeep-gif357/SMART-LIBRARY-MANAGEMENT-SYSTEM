import { query, withTransaction } from '@/lib/db.js';
import { getSession } from '@/lib/auth.js';
import { handler, json, readJson, requireUser, toInt } from '@/lib/api.js';
import { embedQuery, toVectorLiteral } from '@/lib/embedding.js';
import { saveBook, validateBook } from '@/lib/books.js';

export const dynamic = 'force-dynamic';

// GET /api/books?q=&category=&available=true&mode=keyword|semantic&sort=title|popular|newest&page=&limit=
export const GET = handler(async (request) => {
  const sp = new URL(request.url).searchParams;
  const q = (sp.get('q') || '').trim().slice(0, 200);
  const categoryId = toInt(sp.get('category'));
  const availableOnly = sp.get('available') === 'true';
  const semantic = sp.get('mode') === 'semantic' && q !== '';
  const sort = sp.get('sort') || '';
  const limit = Math.min(Math.max(toInt(sp.get('limit'), 12), 1), 200);
  const page = Math.max(toInt(sp.get('page'), 1), 1);

  const params = [];
  const add = (value) => {
    params.push(value);
    return `$${params.length}`;
  };
  const where = [];
  let rankSql = '0::float AS relevance';
  let orderBy = 'c.title';

  if (Number.isInteger(categoryId)) where.push(`c.category_id = ${add(categoryId)}`);
  if (availableOnly) where.push('c.available_copies > 0');

  if (q && semantic) {
    // vector similarity search (pgvector, cosine distance)
    const qv = embedQuery(q);
    if (qv) {
      const p = add(toVectorLiteral(qv));
      where.push('b.embedding IS NOT NULL');
      rankSql = `(1 - (b.embedding <=> ${p}::vector))::float AS relevance`;
      orderBy = `b.embedding <=> ${p}::vector`;
    } else {
      where.push('FALSE');
    }
  } else if (q) {
    // full-text search on title + description, plus title/author substring match
    const t = add(q);
    const like = add(`%${q.replace(/[%_\\]/g, '\\$&')}%`);
    where.push(`(c.search_tsv @@ websearch_to_tsquery('english', ${t}) OR c.title ILIKE ${like} OR c.authors ILIKE ${like})`);
    rankSql = `ts_rank(c.search_tsv, websearch_to_tsquery('english', ${t}))::float AS relevance`;
    orderBy = 'relevance DESC, c.title';
  }

  if (!q || sort) {
    if (sort === 'popular') orderBy = 'c.times_borrowed DESC, c.title';
    else if (sort === 'newest') orderBy = 'c.created_at DESC, c.title';
    else if (!q) orderBy = 'c.title';
  }

  const limitP = add(limit);
  const offsetP = add((page - 1) * limit);
  const { rows } = await query(
    `SELECT c.book_id, c.book_code, c.title, c.authors, c.category, c.category_id, c.publisher,
            c.publication_year, c.description, c.total_copies, c.available_copies, c.times_borrowed,
            ${rankSql}, count(*) OVER()::int AS total
       FROM v_book_catalog c
       JOIN books b ON b.book_id = c.book_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY ${orderBy}
      LIMIT ${limitP} OFFSET ${offsetP}`,
    params
  );

  const total = rows[0]?.total ?? 0;

  // remember searches of logged-in users: this feeds the recommender
  if (q && page === 1) {
    try {
      const user = await getSession();
      if (user) {
        await query(`INSERT INTO activity_log (user_id, action, search_query) VALUES ($1, 'search', $2)`, [user.user_id, q]);
      }
    } catch {
      /* logging must never break searching */
    }
  }

  return json({
    books: rows.map(({ total: _t, ...b }) => b),
    total,
    page,
    pages: Math.max(Math.ceil(total / limit), 1),
  });
});

// POST /api/books  (librarian only)
export const POST = handler(async (request) => {
  await requireUser('librarian');
  const data = validateBook(await readJson(request));
  const id = await withTransaction((client) => saveBook(client, null, data));
  return json({ book_id: id }, 201);
});

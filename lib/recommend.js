import { query } from './db.js';
import { embedQuery, toVectorLiteral, weightedMean } from './embedding.js';

// How strongly each kind of behaviour says "this user is interested in this topic"
const ACTION_WEIGHT = { borrow: 5, reserve: 3, search: 2, view: 1.5 };

const BOOK_COLUMNS = `c.book_id, c.title, c.authors, c.category, c.available_copies, c.total_copies, c.description`;

/**
 * Builds the user's interest vector from their last 80 searches, views, reservations and loans.
 * Newer events count more (3% decay per step back in time).
 * Returns { vector, topCategories, events } - vector is null when the user has no history yet.
 */
export async function getUserProfile(userId) {
  const { rows } = await query(
    `SELECT a.action, a.search_query, b.embedding::text AS emb, cat.name AS category
       FROM activity_log a
       LEFT JOIN books b       ON b.book_id = a.book_id
       LEFT JOIN categories cat ON cat.category_id = b.category_id
      WHERE a.user_id = $1
      ORDER BY a.created_at DESC
      LIMIT 80`,
    [userId]
  );

  const items = [];
  const categoryScore = new Map();
  rows.forEach((row, i) => {
    const weight = (ACTION_WEIGHT[row.action] || 1) * Math.pow(0.97, i);
    let vector = null;
    if (row.action === 'search') vector = embedQuery(row.search_query);
    else if (row.emb) vector = JSON.parse(row.emb);
    if (vector) items.push({ vector, weight });
    if (row.category) categoryScore.set(row.category, (categoryScore.get(row.category) || 0) + weight);
  });

  const topCategories = [...categoryScore.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name]) => name);

  return { vector: weightedMean(items), topCategories, events: rows.length };
}

export async function getPopularBooks(limit = 6) {
  const { rows } = await query(
    `SELECT ${BOOK_COLUMNS}, c.times_borrowed
       FROM v_book_catalog c
      ORDER BY c.times_borrowed DESC, c.title
      LIMIT $1`,
    [limit]
  );
  return rows;
}

/**
 * Hybrid recommender
 *  1. content-based:  nearest books (pgvector cosine distance) to the user's interest vector
 *  2. collaborative:  books borrowed by other readers who share borrowed books with this user
 * Books the user has ever borrowed are excluded.
 */
export async function getRecommendations(userId) {
  const profile = await getUserProfile(userId);

  if (!profile.vector) {
    return { mode: 'cold-start', topCategories: [], personalized: [], alsoBorrowed: [], popular: await getPopularBooks(8) };
  }

  const personalized = await query(
    `SELECT ${BOOK_COLUMNS}, ROUND((1 - (b.embedding <=> $1::vector))::numeric, 3) AS score
       FROM books b
       JOIN v_book_catalog c ON c.book_id = b.book_id
      WHERE b.embedding IS NOT NULL
        AND b.book_id NOT IN (SELECT book_id FROM borrowings WHERE user_id = $2)
      ORDER BY b.embedding <=> $1::vector
      LIMIT 8`,
    [toVectorLiteral(profile.vector), userId]
  );

  const alsoBorrowed = await query(
    `SELECT ${BOOK_COLUMNS}, COUNT(DISTINCT b2.user_id)::int AS readers
       FROM borrowings b1
       JOIN borrowings b2 ON b2.book_id = b1.book_id AND b2.user_id <> b1.user_id
       JOIN borrowings b3 ON b3.user_id = b2.user_id AND b3.book_id <> b1.book_id
       JOIN v_book_catalog c ON c.book_id = b3.book_id
      WHERE b1.user_id = $1
        AND b3.book_id NOT IN (SELECT book_id FROM borrowings WHERE user_id = $1)
      GROUP BY c.book_id, c.title, c.authors, c.category, c.available_copies, c.total_copies, c.description
      ORDER BY readers DESC, c.title
      LIMIT 6`,
    [userId]
  );

  return {
    mode: 'personalized',
    topCategories: profile.topCategories,
    personalized: personalized.rows,
    alsoBorrowed: alsoBorrowed.rows,
    popular: [],
  };
}

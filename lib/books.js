import { embedDocument, bookText, toVectorLiteral } from './embedding.js';
import { ApiError, toInt } from './api.js';

/** Validates the body of "add book" / "edit book" requests and returns clean values. */
export function validateBook(b) {
  const title = String(b.title || '').trim();
  const book_code = String(b.book_code || '').trim();
  const category = String(b.category || '').trim();
  const description = String(b.description || '').trim();
  const publisher = String(b.publisher || '').trim() || null;
  const authors = (Array.isArray(b.authors) ? b.authors : String(b.authors || '').split(','))
    .map((s) => String(s).trim())
    .filter(Boolean);
  const total_copies = toInt(b.total_copies ?? 1);
  const publication_year =
    b.publication_year === '' || b.publication_year == null ? null : toInt(b.publication_year);

  if (!title || title.length > 255) throw new ApiError('Title is required (max 255 characters)');
  if (book_code.length < 3 || book_code.length > 30) throw new ApiError('Book code must be 3-30 characters');
  if (!category || category.length > 80) throw new ApiError('Category is required');
  if (authors.length === 0) throw new ApiError('At least one author is required');
  if (!Number.isInteger(total_copies) || total_copies < 0 || total_copies > 500) {
    throw new ApiError('Total copies must be a number between 0 and 500');
  }
  if (publication_year !== null && (!Number.isInteger(publication_year) || publication_year < 1400 || publication_year > 2100)) {
    throw new ApiError('Publication year must be between 1400 and 2100');
  }
  if (description.length > 3000) throw new ApiError('Description is too long (max 3000 characters)');

  return { title, book_code, category, description, publisher, authors, total_copies, publication_year };
}

/**
 * Inserts (id == null) or updates a book together with its category, authors and embedding.
 * Must be called with a client that is inside a transaction.
 */
export async function saveBook(client, id, d) {
  const cat = await client.query(
    `INSERT INTO categories (name) VALUES ($1)
     ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING category_id`,
    [d.category]
  );
  const categoryId = cat.rows[0].category_id;
  const embedding = toVectorLiteral(
    embedDocument(bookText({ title: d.title, authors: d.authors.join(' '), category: d.category, description: d.description }))
  );

  let bookId = id;
  if (id == null) {
    const r = await client.query(
      `INSERT INTO books (book_code, title, description, publisher, publication_year, category_id,
                          total_copies, available_copies, embedding)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $7, $8::vector) RETURNING book_id`,
      [d.book_code, d.title, d.description, d.publisher, d.publication_year, categoryId, d.total_copies, embedding]
    );
    bookId = r.rows[0].book_id;
  } else {
    const r = await client.query(
      `UPDATE books
          SET book_code = $1, title = $2, description = $3, publisher = $4, publication_year = $5,
              category_id = $6,
              available_copies = available_copies + ($7 - total_copies),
              total_copies = $7,
              embedding = $8::vector
        WHERE book_id = $9
        RETURNING book_id`,
      [d.book_code, d.title, d.description, d.publisher, d.publication_year, categoryId, d.total_copies, embedding, id]
    );
    if (r.rowCount === 0) throw new ApiError('Book not found', 404);
    await client.query('DELETE FROM book_authors WHERE book_id = $1', [bookId]);
  }

  for (const name of d.authors) {
    const a = await client.query(
      `INSERT INTO authors (name) VALUES ($1)
       ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING author_id`,
      [name]
    );
    await client.query(
      'INSERT INTO book_authors (book_id, author_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [bookId, a.rows[0].author_id]
    );
  }
  return bookId;
}

'use client';

import { useEffect, useState } from 'react';
import BookCard from '@/components/BookCard.js';
import { api } from '@/lib/client.js';

const EMPTY = { q: '', category: '', available: false, mode: 'keyword', sort: '' };

export default function BooksPage() {
  const [form, setForm] = useState(EMPTY);
  const [applied, setApplied] = useState(null); // filters currently used for the search
  const [page, setPage] = useState(1);
  const [categories, setCategories] = useState([]);
  const [data, setData] = useState({ books: [], total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // read ?q= from the URL once, load categories
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const initial = { ...EMPTY, q: p.get('q') || '', category: p.get('category') || '' };
    setForm(initial);
    setApplied(initial);
    api('/api/categories').then((d) => setCategories(d.categories)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!applied) return;
    const params = new URLSearchParams();
    if (applied.q) params.set('q', applied.q);
    if (applied.category) params.set('category', applied.category);
    if (applied.available) params.set('available', 'true');
    if (applied.mode === 'semantic') params.set('mode', 'semantic');
    if (applied.sort) params.set('sort', applied.sort);
    params.set('page', String(page));
    params.set('limit', '12');
    setLoading(true);
    setError('');
    api('/api/books?' + params.toString())
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [applied, page]);

  function submit(e) {
    e.preventDefault();
    setPage(1);
    setApplied({ ...form });
  }

  function reset() {
    setForm(EMPTY);
    setPage(1);
    setApplied(EMPTY);
  }

  return (
    <>
      <h1>Browse books</h1>
      <form className="card" onSubmit={submit}>
        <div className="row">
          <div style={{ flex: '2 1 260px' }}>
            <label htmlFor="q">Search</label>
            <input id="q" value={form.q} placeholder="Title, author or topic" onChange={(e) => setForm({ ...form, q: e.target.value })} />
          </div>
          <div>
            <label htmlFor="cat">Category</label>
            <select id="cat" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.category_id} value={c.category_id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="mode">Search type</label>
            <select id="mode" value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}>
              <option value="keyword">Keyword (full-text)</option>
              <option value="semantic">Smart (by meaning)</option>
            </select>
          </div>
          <div>
            <label htmlFor="sort">Sort</label>
            <select id="sort" value={form.sort} onChange={(e) => setForm({ ...form, sort: e.target.value })}>
              <option value="">Best match / title</option>
              <option value="popular">Most borrowed</option>
              <option value="newest">Recently added</option>
            </select>
          </div>
        </div>
        <div className="actions" style={{ marginTop: 12 }}>
          <label className="inline-check" style={{ marginBottom: 0 }}>
            <input type="checkbox" checked={form.available} onChange={(e) => setForm({ ...form, available: e.target.checked })} />
            Only available books
          </label>
          <button className="btn" type="submit">
            Search
          </button>
          <button className="btn secondary" type="button" onClick={reset}>
            Reset
          </button>
        </div>
      </form>

      <div className="spacer" />
      {error && <div className="alert error">{error}</div>}
      {loading ? (
        <p className="muted">Loading...</p>
      ) : data.books.length === 0 ? (
        <div className="alert info">No books found. Try different words or switch to "Smart (by meaning)" search.</div>
      ) : (
        <>
          <p className="muted small">{data.total} book(s) found</p>
          <div className="grid">
            {data.books.map((b) => (
              <BookCard key={b.book_id} book={b} />
            ))}
          </div>
          {data.pages > 1 && (
            <div className="pager">
              <button className="btn secondary small" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                Previous
              </button>
              <span className="muted small">
                Page {data.page} of {data.pages}
              </span>
              <button className="btn secondary small" disabled={page >= data.pages} onClick={() => setPage(page + 1)}>
                Next
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}

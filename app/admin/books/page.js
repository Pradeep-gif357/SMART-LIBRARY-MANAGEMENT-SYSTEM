'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import AdminGuard from '@/components/AdminGuard.js';
import { api } from '@/lib/client.js';

const EMPTY = { book_code: '', title: '', authors: '', category: '', publication_year: '', publisher: '', total_copies: 1, description: '' };

function BookManager() {
  const [books, setBooks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [filter, setFilter] = useState('');
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(() => {
    api('/api/books?limit=200&sort=newest')
      .then((d) => setBooks(d.books))
      .catch((e) => setError(e.message));
    api('/api/categories').then((d) => setCategories(d.categories)).catch(() => {});
  }, []);

  useEffect(load, [load]);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  async function save(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      if (editingId) {
        await api(`/api/books/${editingId}`, { method: 'PUT', body: form });
        setMessage('Book updated.');
      } else {
        await api('/api/books', { method: 'POST', body: form });
        setMessage('Book added.');
      }
      setForm(EMPTY);
      setEditingId(null);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  function edit(b) {
    setEditingId(b.book_id);
    setForm({
      book_code: b.book_code,
      title: b.title,
      authors: b.authors,
      category: b.category,
      publication_year: b.publication_year ?? '',
      publisher: b.publisher ?? '',
      total_copies: b.total_copies,
      description: b.description || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function remove(b) {
    if (!window.confirm(`Delete "${b.title}"?`)) return;
    setError('');
    setMessage('');
    try {
      await api(`/api/books/${b.book_id}`, { method: 'DELETE' });
      setMessage('Book deleted.');
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  const shown = books.filter((b) => (b.title + ' ' + b.authors).toLowerCase().includes(filter.toLowerCase()));

  return (
    <>
      {message && <div className="alert success">{message}</div>}
      {error && <div className="alert error">{error}</div>}

      <form className="card" onSubmit={save}>
        <h2 style={{ marginTop: 0 }}>{editingId ? 'Edit book' : 'Add a new book'}</h2>
        <div className="row">
          <div>
            <label>Book code / ISBN *</label>
            <input required minLength={3} maxLength={30} value={form.book_code} onChange={set('book_code')} />
          </div>
          <div style={{ flex: '2 1 260px' }}>
            <label>Title *</label>
            <input required maxLength={255} value={form.title} onChange={set('title')} />
          </div>
          <div style={{ flex: '2 1 260px' }}>
            <label>Authors * (comma separated)</label>
            <input required value={form.authors} onChange={set('authors')} />
          </div>
        </div>
        <div className="spacer" />
        <div className="row">
          <div>
            <label>Category * (pick or type a new one)</label>
            <input required list="cats" value={form.category} onChange={set('category')} />
            <datalist id="cats">
              {categories.map((c) => (
                <option key={c.category_id} value={c.name} />
              ))}
            </datalist>
          </div>
          <div>
            <label>Publisher</label>
            <input value={form.publisher} onChange={set('publisher')} />
          </div>
          <div>
            <label>Year</label>
            <input type="number" min="1400" max="2100" value={form.publication_year} onChange={set('publication_year')} />
          </div>
          <div>
            <label>Total copies *</label>
            <input type="number" required min="0" max="500" value={form.total_copies} onChange={set('total_copies')} />
          </div>
        </div>
        <div className="spacer" />
        <label>Description (used to build the book's recommendation vector)</label>
        <textarea rows={3} maxLength={3000} value={form.description} onChange={set('description')} />
        <div className="actions" style={{ marginTop: 12 }}>
          <button className="btn" type="submit">
            {editingId ? 'Save changes' : 'Add book'}
          </button>
          {editingId && (
            <button
              className="btn secondary"
              type="button"
              onClick={() => {
                setEditingId(null);
                setForm(EMPTY);
              }}
            >
              Cancel edit
            </button>
          )}
        </div>
      </form>

      <h2>All books ({books.length})</h2>
      <div className="field">
        <input placeholder="Filter by title or author..." value={filter} onChange={(e) => setFilter(e.target.value)} />
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Category</th>
              <th>Copies</th>
              <th>Loans</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {shown.map((b) => (
              <tr key={b.book_id}>
                <td>
                  <Link href={`/books/${b.book_id}`}>{b.title}</Link>
                  <div className="muted small">{b.authors}</div>
                </td>
                <td>{b.category}</td>
                <td>
                  {b.available_copies}/{b.total_copies}
                </td>
                <td>{b.times_borrowed}</td>
                <td>
                  <div className="actions">
                    <button className="btn secondary small" onClick={() => edit(b)}>
                      Edit
                    </button>
                    <button className="btn danger small" onClick={() => remove(b)}>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function AdminBooks() {
  return (
    <>
      <h1>Manage books</h1>
      <AdminGuard active="/admin/books">
        <BookManager />
      </AdminGuard>
    </>
  );
}

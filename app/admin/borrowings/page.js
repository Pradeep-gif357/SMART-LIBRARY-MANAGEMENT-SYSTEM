'use client';

import { useCallback, useEffect, useState } from 'react';
import AdminGuard from '@/components/AdminGuard.js';
import { api, fmtDate, money } from '@/lib/client.js';

function Borrowings() {
  const [status, setStatus] = useState('active');
  const [rows, setRows] = useState([]);
  const [users, setUsers] = useState([]);
  const [books, setBooks] = useState([]);
  const [issue, setIssue] = useState({ userId: '', bookId: '' });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(() => {
    api(`/api/admin/borrowings?status=${status}`)
      .then((d) => setRows(d.borrowings))
      .catch((e) => setError(e.message));
  }, [status]);

  useEffect(load, [load]);

  useEffect(() => {
    api('/api/admin/users').then((d) => setUsers(d.users.filter((u) => u.role === 'student'))).catch(() => {});
    api('/api/books?limit=200&available=true').then((d) => setBooks(d.books)).catch(() => {});
  }, []);

  async function giveBack(r) {
    setError('');
    setMessage('');
    try {
      const res = await api('/api/return', { method: 'POST', body: { borrowingId: r.borrowing_id } });
      setMessage(`Marked "${r.title}" as returned${res.fine > 0 ? ` - fine ${money(res.fine)}` : ''}.`);
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function issueBook(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      const r = await api('/api/borrow', { method: 'POST', body: { userId: Number(issue.userId), bookId: Number(issue.bookId) } });
      setMessage(`Book issued. Due date: ${fmtDate(r.due_date)}.`);
      setIssue({ userId: '', bookId: '' });
      load();
      api('/api/books?limit=200&available=true').then((d) => setBooks(d.books)).catch(() => {});
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      {message && <div className="alert success">{message}</div>}
      {error && <div className="alert error">{error}</div>}

      <form className="card" onSubmit={issueBook}>
        <h2 style={{ marginTop: 0 }}>Issue a book at the desk</h2>
        <div className="row">
          <div>
            <label>Student</label>
            <select required value={issue.userId} onChange={(e) => setIssue({ ...issue, userId: e.target.value })}>
              <option value="">Select student...</option>
              {users.map((u) => (
                <option key={u.user_id} value={u.user_id}>
                  {u.name} ({u.email})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Book (available only)</label>
            <select required value={issue.bookId} onChange={(e) => setIssue({ ...issue, bookId: e.target.value })}>
              <option value="">Select book...</option>
              {books.map((b) => (
                <option key={b.book_id} value={b.book_id}>
                  {b.title} ({b.available_copies} left)
                </option>
              ))}
            </select>
          </div>
          <button className="btn shrink" type="submit">
            Issue book
          </button>
        </div>
      </form>

      <div className="actions" style={{ margin: '20px 0 12px' }}>
        {['active', 'overdue', 'returned', 'all'].map((s) => (
          <button key={s} className={status === s ? 'btn small' : 'btn secondary small'} onClick={() => setStatus(s)}>
            {s[0].toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Student</th>
              <th>Book</th>
              <th>Borrowed</th>
              <th>Due</th>
              <th>Status</th>
              <th>Fine</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="muted">
                  No records.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.borrowing_id}>
                <td>
                  {r.user_name}
                  <div className="muted small">{r.email}</div>
                </td>
                <td>{r.title}</td>
                <td>{fmtDate(r.borrowed_at)}</td>
                <td>{fmtDate(r.due_date)}</td>
                <td>
                  {r.returned_at ? (
                    <span className="badge muted">Returned {fmtDate(r.returned_at)}</span>
                  ) : r.overdue ? (
                    <span className="badge bad">Overdue</span>
                  ) : (
                    <span className="badge ok">On loan</span>
                  )}
                </td>
                <td>{Number(r.fine) > 0 ? money(r.fine) : '-'}</td>
                <td>
                  {!r.returned_at && (
                    <button className="btn small" onClick={() => giveBack(r)}>
                      Mark returned
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function AdminBorrowings() {
  return (
    <>
      <h1>Borrowing records</h1>
      <AdminGuard active="/admin/borrowings">
        <Borrowings />
      </AdminGuard>
    </>
  );
}

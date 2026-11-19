'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AdminGuard from '@/components/AdminGuard.js';
import { api, fmtDate, money } from '@/lib/client.js';

function Dashboard() {
  const [s, setS] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/api/admin/stats')
      .then(setS)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="alert error">{error}</div>;
  if (!s) return <p className="muted">Loading...</p>;
  const t = s.totals;
  const maxLoans = Math.max(1, ...s.categories.map((c) => c.total_loans));

  return (
    <>
      <div className="tiles">
        <div className="tile">
          <div className="num">{t.titles}</div>
          <div className="label">Book titles</div>
        </div>
        <div className="tile">
          <div className="num">
            {t.available_copies}/{t.copies}
          </div>
          <div className="label">Copies available</div>
        </div>
        <div className="tile">
          <div className="num">{t.students}</div>
          <div className="label">Students</div>
        </div>
        <div className="tile">
          <div className="num">{t.active_loans}</div>
          <div className="label">Books on loan</div>
        </div>
        <div className={t.overdue_loans > 0 ? 'tile alert-tile' : 'tile'}>
          <div className="num">{t.overdue_loans}</div>
          <div className="label">Overdue loans</div>
        </div>
        <div className="tile">
          <div className="num">{t.open_reservations}</div>
          <div className="label">Open reservations</div>
        </div>
        <div className="tile">
          <div className="num">{money(t.fines_charged)}</div>
          <div className="label">Fines charged</div>
        </div>
      </div>

      <h2>Overdue loans</h2>
      {s.overdue.length === 0 ? (
        <p className="muted">No overdue loans.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Book</th>
                <th>Due</th>
                <th>Days late</th>
                <th>Fine so far</th>
              </tr>
            </thead>
            <tbody>
              {s.overdue.map((o) => (
                <tr key={o.borrowing_id}>
                  <td>
                    {o.user_name}
                    <div className="muted small">{o.email}</div>
                  </td>
                  <td>{o.title}</td>
                  <td>{fmtDate(o.due_date)}</td>
                  <td>
                    <span className="badge bad">{o.days_overdue}</span>
                  </td>
                  <td>{money(o.estimated_fine)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="two-col">
        <div>
          <h2>Most popular books</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Book</th>
                  <th>Loans</th>
                  <th>Views</th>
                </tr>
              </thead>
              <tbody>
                {s.popular.map((p) => (
                  <tr key={p.book_id}>
                    <td>
                      <Link href={`/books/${p.book_id}`}>{p.title}</Link>
                    </td>
                    <td>{p.borrow_count}</td>
                    <td>{p.view_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <h2>Loans by category</h2>
          <div className="card">
            {s.categories.map((c) => (
              <div key={c.category} style={{ marginBottom: 10 }}>
                <div className="small">
                  {c.category} <span className="muted">({c.titles} titles, {c.total_loans} loans)</span>
                </div>
                <div className="bar">
                  <span style={{ width: `${(c.total_loans / maxLoans) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="two-col">
        <div>
          <h2>Top readers (2+ loans)</h2>
          <div className="table-wrap">
            <table>
              <tbody>
                {s.topReaders.map((r) => (
                  <tr key={r.name}>
                    <td>{r.name}</td>
                    <td>{r.loans} loans</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <h2>Trending searches</h2>
          <div className="table-wrap">
            <table>
              <tbody>
                {s.trending.length === 0 ? (
                  <tr>
                    <td className="muted">No searches yet</td>
                  </tr>
                ) : (
                  s.trending.map((r) => (
                    <tr key={r.term}>
                      <td>{r.term}</td>
                      <td>{r.searches}x</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <h2>Never borrowed</h2>
      <p className="muted small">Candidates for promotion or weeding.</p>
      <div className="actions">
        {s.neverBorrowed.length === 0 ? (
          <span className="muted">Every title has been borrowed at least once.</span>
        ) : (
          s.neverBorrowed.map((b) => (
            <Link key={b.book_id} href={`/books/${b.book_id}`} className="badge muted">
              {b.title}
            </Link>
          ))
        )}
      </div>
    </>
  );
}

export default function AdminHome() {
  return (
    <>
      <h1>Librarian dashboard</h1>
      <AdminGuard active="/admin">
        <Dashboard />
      </AdminGuard>
    </>
  );
}

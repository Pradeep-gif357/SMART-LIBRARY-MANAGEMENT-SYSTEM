'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, fmtDate, money, useUser } from '@/lib/client.js';

export default function MyLibrary() {
  const user = useUser();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(() => {
    api('/api/my')
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  async function giveBack(loan) {
    setError('');
    setMessage('');
    try {
      const r = await api('/api/return', { method: 'POST', body: { borrowingId: loan.borrowing_id } });
      setMessage(r.fine > 0 ? `Returned "${loan.title}". A late fine of ${money(r.fine)} was charged.` : `Returned "${loan.title}". Thank you!`);
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function cancel(r) {
    setError('');
    setMessage('');
    try {
      await api(`/api/reserve?id=${r.reservation_id}`, { method: 'DELETE' });
      setMessage('Reservation cancelled.');
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  if (user === undefined) return <p className="muted">Loading...</p>;
  if (user === null) {
    return (
      <div className="card narrow">
        <h2>Please log in</h2>
        <Link href="/login" className="btn">
          Log in
        </Link>
      </div>
    );
  }

  return (
    <>
      <h1>My library</h1>
      {message && <div className="alert success">{message}</div>}
      {error && <div className="alert error">{error}</div>}
      {!data ? (
        <p className="muted">Loading...</p>
      ) : (
        <>
          <div className="tiles">
            <div className="tile">
              <div className="num">{data.active.length}/3</div>
              <div className="label">Books on loan</div>
            </div>
            <div className="tile">
              <div className="num">{data.reservations.length}</div>
              <div className="label">Reservations</div>
            </div>
            <div className={data.finesOwed > 0 ? 'tile alert-tile' : 'tile'}>
              <div className="num">{money(data.finesOwed)}</div>
              <div className="label">Fine building up (Rs. 2 / late day)</div>
            </div>
            <div className="tile">
              <div className="num">{money(data.finesPaid)}</div>
              <div className="label">Fines charged so far</div>
            </div>
          </div>

          <h2>Currently borrowed</h2>
          {data.active.length === 0 ? (
            <p className="muted">
              Nothing borrowed right now. <Link href="/books">Find a book</Link>
            </p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Book</th>
                    <th>Borrowed</th>
                    <th>Due</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {data.active.map((l) => (
                    <tr key={l.borrowing_id}>
                      <td>
                        <Link href={`/books/${l.book_id}`}>{l.title}</Link>
                        <div className="muted small">{l.authors}</div>
                      </td>
                      <td>{fmtDate(l.borrowed_at)}</td>
                      <td>{fmtDate(l.due_date)}</td>
                      <td>{l.overdue ? <span className="badge bad">Overdue - {money(l.current_fine)}</span> : <span className="badge ok">On time</span>}</td>
                      <td>
                        <button className="btn small" onClick={() => giveBack(l)}>
                          Return
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <h2>Reservations</h2>
          {data.reservations.length === 0 ? (
            <p className="muted">No reservations.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Book</th>
                    <th>Reserved on</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {data.reservations.map((r) => (
                    <tr key={r.reservation_id}>
                      <td>
                        <Link href={`/books/${r.book_id}`}>{r.title}</Link>
                      </td>
                      <td>{fmtDate(r.reserved_at)}</td>
                      <td>
                        {r.status === 'ready' ? (
                          <span className="badge ok">Ready - borrow it now</span>
                        ) : (
                          <span className="badge warn">Waiting (position {r.queue_position})</span>
                        )}
                      </td>
                      <td>
                        <button className="btn danger small" onClick={() => cancel(r)}>
                          Cancel
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <h2>Borrowing history</h2>
          {data.history.length === 0 ? (
            <p className="muted">No past loans yet.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Book</th>
                    <th>Borrowed</th>
                    <th>Returned</th>
                    <th>Fine</th>
                  </tr>
                </thead>
                <tbody>
                  {data.history.map((l) => (
                    <tr key={l.borrowing_id}>
                      <td>
                        <Link href={`/books/${l.book_id}`}>{l.title}</Link>
                      </td>
                      <td>{fmtDate(l.borrowed_at)}</td>
                      <td>{fmtDate(l.returned_at)}</td>
                      <td>{Number(l.fine_amount) > 0 ? money(l.fine_amount) : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );
}

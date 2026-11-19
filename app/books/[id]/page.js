'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import BookCard, { Availability, coverColor } from '@/components/BookCard.js';
import { api, fmtDate, useUser } from '@/lib/client.js';

export default function BookDetail() {
  const { id } = useParams();
  const user = useUser();
  const [info, setInfo] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api(`/api/books/${id}`)
      .then(setInfo)
      .catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => {
    if (user !== undefined) load(); // wait for the session so the "view" is recorded for the right user
  }, [user, load]);

  async function act(path, body, okMessage) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const r = await api(path, { method: 'POST', body });
      setMessage(typeof okMessage === 'function' ? okMessage(r) : okMessage);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (error && !info) return <div className="alert error">{error}</div>;
  if (!info) return <p className="muted">Loading...</p>;

  const { book, similar, myLoan, myReservation, waiting } = info;
  const available = Number(book.available_copies) > 0;

  return (
    <>
      <p>
        <Link href="/books">&larr; Back to books</Link>
      </p>
      {message && <div className="alert success">{message}</div>}
      {error && <div className="alert error">{error}</div>}

      <div className="detail">
        <div className="cover" style={{ background: coverColor(book.book_id) }}>
          {book.category}
        </div>
        <div>
          <h1>{book.title}</h1>
          <p className="muted">by {book.authors}</p>
          <div className="actions" style={{ marginBottom: 14 }}>
            <Availability book={book} />
            <span className="badge muted">{book.category}</span>
            {book.publication_year && <span className="badge muted">{book.publication_year}</span>}
            <span className="badge muted">Borrowed {book.times_borrowed}x</span>
          </div>
          <p>{book.description || 'No description yet.'}</p>
          <p className="muted small">Code: {book.book_code}</p>

          <div className="actions" style={{ marginTop: 16 }}>
            {user === null && (
              <Link className="btn" href="/login">
                Log in to borrow
              </Link>
            )}
            {user && myLoan && <span className="badge info">You have this book. Due {fmtDate(myLoan.due_date)}</span>}
            {user && !myLoan && available && (
              <button
                className="btn"
                disabled={busy}
                onClick={() => act('/api/borrow', { bookId: book.book_id }, (r) => `Borrowed! Please return it by ${fmtDate(r.due_date)}.`)}
              >
                Borrow this book
              </button>
            )}
            {user && !myLoan && !available && !myReservation && (
              <button className="btn secondary" disabled={busy} onClick={() => act('/api/reserve', { bookId: book.book_id }, 'Reserved. You will see it as "ready" in My library when a copy is returned.')}>
                Reserve (join waiting list)
              </button>
            )}
            {user && myReservation && (
              <span className="badge warn">
                {myReservation.status === 'ready' ? 'Your reserved copy is ready - borrow it now!' : 'You are on the waiting list'}
              </span>
            )}
            {waiting > 0 && <span className="muted small">{waiting} reader(s) waiting</span>}
          </div>
        </div>
      </div>

      {similar.length > 0 && (
        <>
          <h2>More like this</h2>
          <div className="grid">
            {similar.map((b) => (
              <BookCard key={b.book_id} book={b} />
            ))}
          </div>
        </>
      )}
    </>
  );
}

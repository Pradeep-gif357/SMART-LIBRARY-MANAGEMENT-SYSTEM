'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import BookCard from '@/components/BookCard.js';
import { api, useUser } from '@/lib/client.js';

export default function Home() {
  const user = useUser();
  const [popular, setPopular] = useState([]);
  const [recs, setRecs] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/api/books?sort=popular&limit=6')
      .then((d) => setPopular(d.books))
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (user) api('/api/recommendations').then(setRecs).catch(() => {});
  }, [user]);

  const personal = recs && recs.mode === 'personalized';

  return (
    <>
      <section className="hero">
        <h1>Find your next book</h1>
        <p>
          Search the catalogue, borrow and reserve books online, and get recommendations based on what you search,
          view and borrow.
        </p>
        <form action="/books" method="get">
          <input name="q" placeholder="Search by title, author or topic..." aria-label="Search books" />
          <button className="btn" type="submit">
            Search
          </button>
        </form>
      </section>

      {error && <div className="alert error" style={{ marginTop: 16 }}>{error}</div>}

      {user && personal && (
        <>
          <h2>Recommended for you</h2>
          <p className="muted small">
            Based on your searches, views and loans{recs.topCategories.length ? ` (mostly ${recs.topCategories.join(', ')})` : ''}.
          </p>
          <div className="grid">
            {recs.personalized.slice(0, 6).map((b) => (
              <BookCard key={b.book_id} book={b} />
            ))}
          </div>
          {recs.alsoBorrowed.length > 0 && (
            <>
              <h2>Readers like you also borrowed</h2>
              <div className="grid">
                {recs.alsoBorrowed.slice(0, 4).map((b) => (
                  <BookCard key={b.book_id} book={b} />
                ))}
              </div>
            </>
          )}
        </>
      )}

      {user === null && (
        <div className="alert info" style={{ marginTop: 16 }}>
          <Link href="/login">Log in</Link> or <Link href="/register">create an account</Link> to borrow books and get
          personalised recommendations.
        </div>
      )}
      {user && recs && !personal && (
        <div className="alert info" style={{ marginTop: 16 }}>
          Search or open a few books and your personal recommendations will appear here.
        </div>
      )}

      <h2>Popular right now</h2>
      <div className="grid">
        {popular.map((b) => (
          <BookCard key={b.book_id} book={b} />
        ))}
      </div>
      <div className="spacer" />
      <Link href="/books" className="btn secondary">
        Browse all books
      </Link>
    </>
  );
}

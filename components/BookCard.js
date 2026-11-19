import Link from 'next/link';

const COLORS = ['#4f46e5', '#0891b2', '#059669', '#d97706', '#db2777', '#7c3aed', '#dc2626', '#2563eb'];

export function Availability({ book }) {
  const left = Number(book.available_copies);
  const total = Number(book.total_copies);
  return left > 0 ? (
    <span className="badge ok">
      {left}/{total} available
    </span>
  ) : (
    <span className="badge warn">On loan</span>
  );
}

export function coverColor(id) {
  return COLORS[Number(id) % COLORS.length];
}

export default function BookCard({ book }) {
  const score = book.score != null ? Math.round(Number(book.score) * 100) : null;
  return (
    <Link href={`/books/${book.book_id}`} className="book-card" style={{ textDecoration: 'none' }}>
      <div className="cover" style={{ background: coverColor(book.book_id) }}>
        {book.category}
      </div>
      <div className="book-body">
        <span className="book-title">{book.title}</span>
        <span className="book-meta">{book.authors}</span>
        <div className="actions">
          <Availability book={book} />
          {score != null && score > 0 && <span className="badge info">{score}% match</span>}
          {book.readers != null && <span className="badge info">{book.readers} reader(s) like you</span>}
        </div>
        {book.why && <span className="why">{book.why}</span>}
      </div>
    </Link>
  );
}

'use client';

import Link from 'next/link';
import { useUser } from '@/lib/client.js';

const TABS = [
  ['/admin', 'Dashboard'],
  ['/admin/books', 'Books'],
  ['/admin/borrowings', 'Borrowings'],
  ['/admin/users', 'Users'],
];

/** Shows children only to librarians (the API enforces this again on the server). */
export default function AdminGuard({ active, children }) {
  const user = useUser();
  if (user === undefined) return <p className="muted">Loading...</p>;
  if (!user || user.role !== 'librarian') {
    return (
      <div className="card narrow">
        <h2>Librarian access only</h2>
        <p className="muted">Please log in with a librarian account to open the admin area.</p>
        <Link href="/login" className="btn">
          Log in
        </Link>
      </div>
    );
  }
  return (
    <>
      <div className="actions" style={{ marginBottom: 18 }}>
        {TABS.map(([href, label]) => (
          <Link key={href} href={href} className={active === href ? 'btn small' : 'btn secondary small'}>
            {label}
          </Link>
        ))}
      </div>
      {children}
    </>
  );
}

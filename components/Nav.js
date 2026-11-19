'use client';

import Link from 'next/link';
import { api, useUser } from '@/lib/client.js';

export default function Nav() {
  const user = useUser();

  async function logout() {
    try {
      await api('/api/auth/logout', { method: 'POST' });
    } finally {
      window.location.href = '/';
    }
  }

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <Link href="/" className="brand">
          Smart Library
        </Link>
        <nav className="nav-links">
          <Link href="/books">Browse books</Link>
          <Link href="/assistant">AI assistant</Link>
          {user && <Link href="/my">My library</Link>}
          {user && user.role === 'librarian' && <Link href="/admin">Admin</Link>}
        </nav>
        <div className="nav-user">
          {user === undefined ? null : user ? (
            <>
              <span>
                {user.name} ({user.role})
              </span>
              <button className="btn secondary small" onClick={logout}>
                Log out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="btn secondary small">
                Log in
              </Link>
              <Link href="/register" className="btn small">
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

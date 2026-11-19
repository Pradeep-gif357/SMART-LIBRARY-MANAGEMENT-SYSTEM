'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/client.js';

export default function LoginPage() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/api/auth/login', { method: 'POST', body: form });
      window.location.href = '/'; // full reload so the navbar picks up the session
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="card narrow">
      <h1>Log in</h1>
      {error && <div className="alert error">{error}</div>}
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input id="password" type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </div>
        <button className="btn" disabled={busy} type="submit">
          {busy ? 'Logging in...' : 'Log in'}
        </button>
      </form>
      <p className="muted small" style={{ marginTop: 14 }}>
        New here? <Link href="/register">Create an account</Link>
      </p>
      <p className="muted small">
        Demo: student@library.com / Student@123 &nbsp;|&nbsp; librarian@library.com / Admin@123
      </p>
    </div>
  );
}

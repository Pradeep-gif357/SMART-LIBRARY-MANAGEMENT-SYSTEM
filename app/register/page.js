'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/client.js';

export default function RegisterPage() {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/api/auth/register', { method: 'POST', body: form });
      window.location.href = '/';
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="card narrow">
      <h1>Create account</h1>
      {error && <div className="alert error">{error}</div>}
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="name">Full name</label>
          <input id="name" required minLength={2} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="password">Password (at least 8 characters)</label>
          <input id="password" type="password" required minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </div>
        <button className="btn" disabled={busy} type="submit">
          {busy ? 'Creating...' : 'Sign up'}
        </button>
      </form>
      <p className="muted small" style={{ marginTop: 14 }}>
        Already registered? <Link href="/login">Log in</Link>
      </p>
    </div>
  );
}

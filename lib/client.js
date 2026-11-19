'use client';

import { useEffect, useState } from 'react';

/** fetch wrapper used by every page: sends/receives JSON and throws Error(message) on failure */
export async function api(url, options = {}) {
  const { body, headers, ...rest } = options;
  const res = await fetch(url, {
    credentials: 'same-origin',
    ...rest,
    headers: { 'Content-Type': 'application/json', ...(headers || {}) },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* no body */
  }
  if (!res.ok) throw new Error((data && data.error) || `Request failed (${res.status})`);
  return data;
}

/** undefined = still loading, null = not logged in, object = logged-in user */
export function useUser() {
  const [user, setUser] = useState(undefined);
  useEffect(() => {
    api('/api/auth/me')
      .then((d) => setUser(d.user))
      .catch(() => setUser(null));
  }, []);
  return user;
}

export const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

export const money = (n) => 'Rs. ' + Number(n || 0).toFixed(2);

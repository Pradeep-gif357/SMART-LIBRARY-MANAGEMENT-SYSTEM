'use client';

import { useCallback, useEffect, useState } from 'react';
import AdminGuard from '@/components/AdminGuard.js';
import { api, fmtDate, useUser } from '@/lib/client.js';

function Users() {
  const me = useUser();
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(() => {
    api('/api/admin/users')
      .then((d) => setUsers(d.users))
      .catch((e) => setError(e.message));
  }, []);

  useEffect(load, [load]);

  async function changeRole(u, role) {
    setError('');
    setMessage('');
    try {
      await api('/api/admin/users', { method: 'PATCH', body: { userId: u.user_id, role } });
      setMessage(`${u.name} is now a ${role}.`);
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function remove(u) {
    if (!window.confirm(`Delete ${u.name} and their history?`)) return;
    setError('');
    setMessage('');
    try {
      await api(`/api/admin/users?id=${u.user_id}`, { method: 'DELETE' });
      setMessage('User deleted.');
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <>
      {message && <div className="alert success">{message}</div>}
      {error && <div className="alert error">{error}</div>}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Joined</th>
              <th>On loan</th>
              <th>Total loans</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const self = me && me.user_id === u.user_id;
              return (
                <tr key={u.user_id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>
                    <select value={u.role} disabled={self} onChange={(e) => changeRole(u, e.target.value)}>
                      <option value="student">student</option>
                      <option value="librarian">librarian</option>
                    </select>
                  </td>
                  <td>{fmtDate(u.created_at)}</td>
                  <td>{u.active_loans}</td>
                  <td>{u.total_loans}</td>
                  <td>
                    {!self && (
                      <button className="btn danger small" onClick={() => remove(u)}>
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function AdminUsers() {
  return (
    <>
      <h1>Manage users</h1>
      <AdminGuard active="/admin/users">
        <Users />
      </AdminGuard>
    </>
  );
}

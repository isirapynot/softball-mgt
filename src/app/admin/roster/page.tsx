'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface Player {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  jersey_number: string | null;
}

const emptyForm = { name: '', email: '', phone: '', jersey_number: '' };

export default function RosterPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const load = useCallback(async () => {
    const res = await fetch('/api/players');
    if (res.status === 401) { router.push('/admin/login'); return; }
    setPlayers(await res.json());
  }, [router]);

  useEffect(() => { load(); }, [load]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await fetch('/api/players', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setLoading(false);
    if (res.status === 401) { router.push('/admin/login'); return; }
    if (!res.ok) { setError((await res.json()).error); return; }
    setForm(emptyForm);
    load();
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this player?')) return;
    const res = await fetch(`/api/players/${id}`, { method: 'DELETE' });
    if (res.status === 401) { router.push('/admin/login'); return; }
    load();
  }

  function startEdit(p: Player) {
    setEditId(p.id);
    setEditForm({ name: p.name, email: p.email ?? '', phone: p.phone ?? '', jersey_number: p.jersey_number ?? '' });
  }

  async function handleSaveEdit(id: number) {
    const res = await fetch(`/api/players/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    });
    if (res.status === 401) { router.push('/admin/login'); return; }
    setEditId(null);
    load();
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Team Roster</h1>

      {/* Add Player Form */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">Add Player</h2>
        <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Full name"
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="email@example.com"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Phone</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="555-123-4567"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Jersey #</label>
            <input
              type="text"
              value={form.jersey_number}
              onChange={(e) => setForm({ ...form, jersey_number: e.target.value })}
              placeholder="#"
              maxLength={5}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-4 flex items-center gap-3">
            <button
              type="submit"
              disabled={loading}
              className="bg-green-700 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-green-800 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Adding...' : 'Add Player'}
            </button>
            {error && <p className="text-red-600 text-sm">{error}</p>}
          </div>
        </form>
      </div>

      {/* Roster Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {players.length === 0 ? (
          <p className="text-center text-gray-400 py-10">No players yet. Add one above.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">#</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Name</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden sm:table-cell">Email</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden md:table-cell">Phone</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {players.map((p) =>
                editId === p.id ? (
                  <tr key={p.id} className="bg-green-50">
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        value={editForm.jersey_number}
                        onChange={(e) => setEditForm({ ...editForm, jersey_number: e.target.value })}
                        className="w-14 border border-gray-300 rounded px-2 py-1 text-sm"
                        maxLength={5}
                        placeholder="#"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                        required
                      />
                    </td>
                    <td className="px-4 py-2 hidden sm:table-cell">
                      <input
                        type="email"
                        value={editForm.email}
                        onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="px-4 py-2 hidden md:table-cell">
                      <input
                        type="tel"
                        value={editForm.phone}
                        onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      <button
                        onClick={() => handleSaveEdit(p.id)}
                        className="text-green-700 font-semibold hover:underline mr-3"
                      >
                        Save
                      </button>
                      <button onClick={() => setEditId(null)} className="text-gray-400 hover:underline">
                        Cancel
                      </button>
                    </td>
                  </tr>
                ) : (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500 font-mono">{p.jersey_number ?? '—'}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{p.name}</td>
                    <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{p.email ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{p.phone ?? '—'}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => startEdit(p)}
                        className="text-blue-600 hover:underline mr-3"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(p.id)}
                        className="text-red-500 hover:underline"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        )}
      </div>
      <p className="text-xs text-gray-400 mt-3">{players.length} player{players.length !== 1 ? 's' : ''} on roster</p>
    </div>
  );
}

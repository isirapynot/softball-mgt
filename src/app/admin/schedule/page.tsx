'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Game {
  id: number;
  game_date: string;
  game_time: string;
  opponent: string;
  location: string | null;
  home_away: 'home' | 'away';
  notes: string | null;
  season: string | null;
}

const emptyForm = {
  game_date: '',
  game_time: '',
  opponent: '',
  location: '',
  home_away: 'home' as 'home' | 'away',
  notes: '',
  season: '',
};

function formatDate(dateStr: string) {
  const s = String(dateStr).substring(0, 10);
  const [year, month, day] = s.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(timeStr: string) {
  const [h, m] = timeStr.split(':');
  const hour = parseInt(h);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  return `${hour % 12 || 12}:${m} ${ampm}`;
}

export default function SchedulePage() {
  const [games, setGames] = useState<Game[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const load = useCallback(async () => {
    const res = await fetch('/api/games');
    if (res.status === 401) { router.push('/admin/login'); return; }
    setGames(await res.json());
  }, [router]);

  useEffect(() => { load(); }, [load]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await fetch('/api/games', {
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
    if (!confirm('Delete this game? All availability entries for this game will also be deleted.')) return;
    const res = await fetch(`/api/games/${id}`, { method: 'DELETE' });
    if (res.status === 401) { router.push('/admin/login'); return; }
    load();
  }

  function startEdit(g: Game) {
    setEditId(g.id);
    setEditForm({
      game_date: String(g.game_date).substring(0, 10),
      game_time: g.game_time.substring(0, 5),
      opponent: g.opponent,
      location: g.location ?? '',
      home_away: g.home_away,
      notes: g.notes ?? '',
      season: g.season ?? '',
    });
  }

  async function handleSaveEdit(id: number) {
    const res = await fetch(`/api/games/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    });
    if (res.status === 401) { router.push('/admin/login'); return; }
    setEditId(null);
    load();
  }

  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500';

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Game Schedule</h1>

      {/* Add Game Form */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">Add Game</h2>
        <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Date *</label>
            <input type="date" value={form.game_date} onChange={(e) => setForm({ ...form, game_date: e.target.value })} required className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Time *</label>
            <input type="time" value={form.game_time} onChange={(e) => setForm({ ...form, game_time: e.target.value })} required className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Opponent *</label>
            <input type="text" value={form.opponent} onChange={(e) => setForm({ ...form, opponent: e.target.value })} placeholder="Team name" required className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Season</label>
            <input type="text" value={form.season} onChange={(e) => setForm({ ...form, season: e.target.value })} placeholder="e.g. Spring 2025" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Location</label>
            <input type="text" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Field / park name" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Home / Away</label>
            <select value={form.home_away} onChange={(e) => setForm({ ...form, home_away: e.target.value as 'home' | 'away' })} className={inputCls}>
              <option value="home">Home</option>
              <option value="away">Away</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
            <input type="text" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes" className={inputCls} />
          </div>
          <div className="sm:col-span-2 lg:col-span-3 flex items-center gap-3">
            <button type="submit" disabled={loading} className="bg-green-700 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-green-800 disabled:opacity-50 transition-colors">
              {loading ? 'Adding...' : 'Add Game'}
            </button>
            {error && <p className="text-red-600 text-sm">{error}</p>}
          </div>
        </form>
      </div>

      {/* Schedule Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {games.length === 0 ? (
          <p className="text-center text-gray-400 py-10">No games scheduled yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Date</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Time</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Opponent</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden lg:table-cell">Season</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden md:table-cell">Location</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden sm:table-cell">H/A</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {games.map((g) =>
                editId === g.id ? (
                  <tr key={g.id} className="bg-green-50">
                    <td className="px-4 py-2">
                      <input type="date" value={editForm.game_date} onChange={(e) => setEditForm({ ...editForm, game_date: e.target.value })} className="border border-gray-300 rounded px-2 py-1 text-sm w-36" />
                    </td>
                    <td className="px-4 py-2">
                      <input type="time" value={editForm.game_time} onChange={(e) => setEditForm({ ...editForm, game_time: e.target.value })} className="border border-gray-300 rounded px-2 py-1 text-sm w-28" />
                    </td>
                    <td className="px-4 py-2">
                      <input type="text" value={editForm.opponent} onChange={(e) => setEditForm({ ...editForm, opponent: e.target.value })} className="border border-gray-300 rounded px-2 py-1 text-sm w-full" />
                    </td>
                    <td className="px-4 py-2 hidden lg:table-cell">
                      <input type="text" value={editForm.season} onChange={(e) => setEditForm({ ...editForm, season: e.target.value })} placeholder="e.g. Spring 2025" className="border border-gray-300 rounded px-2 py-1 text-sm w-32" />
                    </td>
                    <td className="px-4 py-2 hidden md:table-cell">
                      <input type="text" value={editForm.location} onChange={(e) => setEditForm({ ...editForm, location: e.target.value })} className="border border-gray-300 rounded px-2 py-1 text-sm w-full" />
                    </td>
                    <td className="px-4 py-2 hidden sm:table-cell">
                      <select value={editForm.home_away} onChange={(e) => setEditForm({ ...editForm, home_away: e.target.value as 'home' | 'away' })} className="border border-gray-300 rounded px-2 py-1 text-sm">
                        <option value="home">Home</option>
                        <option value="away">Away</option>
                      </select>
                    </td>
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      <button onClick={() => handleSaveEdit(g.id)} className="text-green-700 font-semibold hover:underline mr-3">Save</button>
                      <button onClick={() => setEditId(null)} className="text-gray-400 hover:underline">Cancel</button>
                    </td>
                  </tr>
                ) : (
                  <tr key={g.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-700">{formatDate(g.game_date)}</td>
                    <td className="px-4 py-3 text-gray-700">{formatTime(g.game_time)}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">vs {g.opponent}</td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {g.season
                        ? <span className="text-xs font-medium bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">{g.season}</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{g.location ?? '—'}</td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${g.home_away === 'home' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                        {g.home_away === 'home' ? 'Home' : 'Away'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <Link href={`/admin/lineup/${g.id}`} className="text-green-700 hover:underline mr-3">Lineup</Link>
                      <Link href={`/admin/stats/${g.id}`} className="text-purple-600 hover:underline mr-3">Stats</Link>
                      <button onClick={() => startEdit(g)} className="text-blue-600 hover:underline mr-3">Edit</button>
                      <button onClick={() => handleDelete(g.id)} className="text-red-500 hover:underline">Delete</button>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        )}
      </div>
      <p className="text-xs text-gray-400 mt-3">{games.length} game{games.length !== 1 ? 's' : ''} scheduled</p>
    </div>
  );
}

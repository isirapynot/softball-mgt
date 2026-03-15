'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface Player {
  id: number;
  name: string;
}

interface Game {
  id: number;
  game_date: string;
  game_time: string;
  opponent: string;
  location: string | null;
  home_away: 'home' | 'away';
  notes: string | null;
}

interface AvailabilityRecord {
  game_id: number;
  player_id: number;
  status: 'yes' | 'no' | 'maybe';
  note: string | null;
}

function formatDate(dateStr: string) {
  const s = String(dateStr).substring(0, 10);
  const [year, month, day] = s.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatTime(timeStr: string) {
  const [h, m] = timeStr.split(':');
  const hour = parseInt(h);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  return `${hour % 12 || 12}:${m} ${ampm}`;
}

const statusConfig = {
  yes: { label: 'In', emoji: '✅', bg: 'bg-green-100 border-green-500 text-green-800', ring: 'ring-green-400' },
  maybe: { label: 'Maybe', emoji: '❓', bg: 'bg-yellow-100 border-yellow-500 text-yellow-800', ring: 'ring-yellow-400' },
  no: { label: 'Out', emoji: '❌', bg: 'bg-red-100 border-red-400 text-red-800', ring: 'ring-red-400' },
};

export default function AvailabilityPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<number | null>(null);
  const [availability, setAvailability] = useState<Record<number, AvailabilityRecord>>({});
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState<Record<number, boolean>>({});
  const [saved, setSaved] = useState<Record<number, boolean>>({});
  const router = useRouter();

  useEffect(() => {
    async function loadBase() {
      const [pRes, gRes] = await Promise.all([fetch('/api/players'), fetch('/api/games')]);
      if (pRes.status === 401 || gRes.status === 401) {
        router.push('/availability/login');
        return;
      }
      setPlayers(await pRes.json());
      const gamesData: Game[] = await gRes.json();
      const today = new Date().toISOString().split('T')[0];
      setGames(gamesData.filter((g) => String(g.game_date).substring(0, 10) >= today));
    }
    loadBase();
  }, [router]);

  const loadAvailability = useCallback(async (playerId: number) => {
    const perGame: Record<number, AvailabilityRecord> = {};
    for (const g of games) {
      const r = await fetch(`/api/availability?game_id=${g.id}`);
      const rows: AvailabilityRecord[] = await r.json();
      const mine = rows.find((x) => x.player_id === playerId);
      if (mine) perGame[g.id] = mine;
    }
    setAvailability(perGame);
    const noteMap: Record<number, string> = {};
    Object.entries(perGame).forEach(([gid, rec]) => {
      noteMap[Number(gid)] = rec.note ?? '';
    });
    setNotes(noteMap);
  }, [games]);

  useEffect(() => {
    if (selectedPlayer && games.length > 0) {
      loadAvailability(selectedPlayer);
    }
  }, [selectedPlayer, games, loadAvailability]);

  async function setStatus(gameId: number, status: 'yes' | 'no' | 'maybe') {
    if (!selectedPlayer) return;
    setSaving((s) => ({ ...s, [gameId]: true }));
    const note = notes[gameId] ?? '';
    await fetch('/api/availability', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player_id: selectedPlayer, game_id: gameId, status, note }),
    });
    setAvailability((a) => ({
      ...a,
      [gameId]: { game_id: gameId, player_id: selectedPlayer, status, note },
    }));
    setSaving((s) => ({ ...s, [gameId]: false }));
    setSaved((s) => ({ ...s, [gameId]: true }));
    setTimeout(() => setSaved((s) => ({ ...s, [gameId]: false })), 2000);
  }

  async function saveNote(gameId: number) {
    const current = availability[gameId];
    if (!current || !selectedPlayer) return;
    await fetch('/api/availability', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player_id: selectedPlayer, game_id: gameId, status: current.status, note: notes[gameId] }),
    });
    setSaved((s) => ({ ...s, [gameId]: true }));
    setTimeout(() => setSaved((s) => ({ ...s, [gameId]: false })), 2000);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">My Availability</h1>

      {/* Player selector */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-6">
        <label className="block text-sm font-semibold text-gray-700 mb-2">Who are you?</label>
        <select
          value={selectedPlayer ?? ''}
          onChange={(e) => {
            const val = e.target.value ? Number(e.target.value) : null;
            setSelectedPlayer(val);
            setAvailability({});
            setNotes({});
          }}
          className="w-full sm:w-72 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="">— Select your name —</option>
          {players.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        {players.length === 0 && (
          <p className="text-sm text-gray-400 mt-2">No players on roster yet. An admin needs to add players first.</p>
        )}
      </div>

      {selectedPlayer && (
        <>
          {games.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-4xl mb-3">📅</p>
              <p>No upcoming games scheduled yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {games.map((g) => {
                const current = availability[g.id];
                return (
                  <div key={g.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                    <div className="flex flex-wrap items-start justify-between gap-2 mb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${g.home_away === 'home' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                            {g.home_away === 'home' ? 'HOME' : 'AWAY'}
                          </span>
                          <span className="font-semibold text-gray-800">vs {g.opponent}</span>
                        </div>
                        <p className="text-sm text-gray-500">
                          {formatDate(g.game_date)} &middot; {formatTime(g.game_time)}
                          {g.location && ` · ${g.location}`}
                        </p>
                      </div>
                      {saved[g.id] && (
                        <span className="text-green-600 text-sm font-medium">Saved!</span>
                      )}
                    </div>

                    {/* Status buttons */}
                    <div className="flex gap-2 flex-wrap mb-3">
                      {(['yes', 'maybe', 'no'] as const).map((s) => {
                        const cfg = statusConfig[s];
                        const isSelected = current?.status === s;
                        return (
                          <button
                            key={s}
                            onClick={() => setStatus(g.id, s)}
                            disabled={saving[g.id]}
                            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg border-2 text-sm font-semibold transition-all ${
                              isSelected
                                ? `${cfg.bg} border-current ring-2 ${cfg.ring}`
                                : 'bg-white border-gray-200 text-gray-500 hover:border-gray-400'
                            }`}
                          >
                            <span>{cfg.emoji}</span>
                            <span>{cfg.label}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Note field — only show if a status is set */}
                    {current && (
                      <div className="flex gap-2 items-center">
                        <input
                          type="text"
                          value={notes[g.id] ?? ''}
                          onChange={(e) => setNotes((n) => ({ ...n, [g.id]: e.target.value }))}
                          onBlur={() => saveNote(g.id)}
                          placeholder="Add a note (optional)..."
                          className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-green-400"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

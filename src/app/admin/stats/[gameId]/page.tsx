'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface Game {
  id: number;
  game_date: string;
  game_time: string;
  opponent: string;
  home_away: 'home' | 'away';
  location: string | null;
}

interface StatRow {
  player_id: number;
  player_name: string;
  batting_slot: number | null;
  ab: number;
  h: number;
  doubles: number;
  triples: number;
  hr: number;
  r: number;
  rbi: number;
  bb: number;
  k: number;
}

const STAT_COLS = [
  { key: 'ab',      label: 'AB',  title: 'At Bats',        highlight: false },
  { key: 'h',       label: 'H',   title: 'Hits',           highlight: false },
  { key: 'doubles', label: '2B',  title: 'Doubles',        highlight: false },
  { key: 'triples', label: '3B',  title: 'Triples',        highlight: false },
  { key: 'hr',      label: 'HR',  title: 'Home Runs',      highlight: false },
  { key: 'r',       label: 'R',   title: 'Runs',           highlight: true  },
  { key: 'rbi',     label: 'RBI', title: 'Runs Batted In', highlight: true  },
  { key: 'bb',      label: 'BB',  title: 'Walks',          highlight: false },
  { key: 'k',       label: 'K',   title: 'Strikeouts',     highlight: false },
] as const;

type StatKey = typeof STAT_COLS[number]['key'];

function avg(h: number, ab: number) {
  if (ab === 0) return '.000';
  return (h / ab).toFixed(3).replace(/^0/, '');
}

function formatDate(dateStr: string) {
  const s = String(dateStr).substring(0, 10);
  const [year, month, day] = s.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });
}

function formatTime(timeStr: string) {
  const [h, m] = timeStr.split(':');
  const hour = parseInt(h);
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;
}

export default function StatsEntryPage() {
  const { gameId } = useParams<{ gameId: string }>();
  const router = useRouter();

  const [game, setGame] = useState<Game | null>(null);
  const [players, setPlayers] = useState<StatRow[]>([]);
  // Map of player_id → current stat values (controlled inputs)
  const [stats, setStats] = useState<Record<number, Record<StatKey, number>>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    const [gameRes, statsRes] = await Promise.all([
      fetch(`/api/games/${gameId}`),
      fetch(`/api/stats?game_id=${gameId}`),
    ]);
    if (gameRes.status === 401 || statsRes.status === 401) {
      router.push('/admin/login');
      return;
    }
    const gameData: Game = await gameRes.json();
    const statsData: StatRow[] = await statsRes.json();
    setGame(gameData);
    setPlayers(statsData);
    // Initialise controlled inputs from loaded data
    const initialStats: Record<number, Record<StatKey, number>> = {};
    for (const row of statsData) {
      initialStats[row.player_id] = {
        ab: row.ab, h: row.h, doubles: row.doubles, triples: row.triples,
        hr: row.hr, r: row.r, rbi: row.rbi, bb: row.bb, k: row.k,
      };
    }
    setStats(initialStats);
    setDirty(false);
    setSaved(false);
  }, [gameId, router]);

  useEffect(() => { load(); }, [load]);

  function updateStat(playerId: number, field: StatKey, raw: string) {
    const val = Math.max(0, parseInt(raw) || 0);
    setStats(prev => ({
      ...prev,
      [playerId]: { ...prev[playerId], [field]: val },
    }));
    setDirty(true);
    setSaved(false);
  }

  async function saveAll() {
    setSaving(true);
    const results = await Promise.all(
      players.map(p =>
        fetch('/api/stats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ game_id: Number(gameId), player_id: p.player_id, ...stats[p.player_id] }),
        })
      )
    );
    setSaving(false);
    if (results.some(r => r.status === 401)) { router.push('/admin/login'); return; }
    setDirty(false);
    setSaved(true);
  }

  const inputCls = 'w-12 text-center border border-gray-200 rounded px-1 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent';

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/admin/schedule" className="text-sm text-gray-400 hover:text-gray-600">← Schedule</Link>
          </div>
          <h1 className="text-2xl font-bold text-gray-800">
            {game ? `vs ${game.opponent}` : 'Loading…'}
          </h1>
          {game && (
            <p className="text-sm text-gray-500 mt-0.5">
              {formatDate(game.game_date)} · {formatTime(game.game_time)}
              {game.location && ` · ${game.location}`}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {saved && !dirty && (
            <span className="text-sm text-green-600 font-medium">✓ Saved</span>
          )}
          {dirty && (
            <span className="text-sm text-yellow-600 font-medium">Unsaved changes</span>
          )}
          <button
            onClick={saveAll}
            disabled={saving || !dirty}
            className="bg-green-700 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-green-800 disabled:opacity-40 transition-colors"
          >
            {saving ? 'Saving…' : 'Save Stats'}
          </button>
        </div>
      </div>

      {/* Stats table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
        {players.length === 0 ? (
          <p className="text-center text-gray-400 py-12">No players found.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 sticky left-0 bg-gray-50">#</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 sticky left-8 bg-gray-50">Player</th>
                {STAT_COLS.map(col => (
                  <th key={col.key} title={col.title} className={`px-2 py-3 font-semibold text-gray-600 text-center w-14${col.highlight ? ' bg-gray-200' : ''}`}>
                    {col.label}
                  </th>
                ))}
                <th className="px-3 py-3 font-semibold text-gray-500 text-center w-14" title="Batting Average">AVG</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {players.map((p, i) => {
                const s = stats[p.player_id] ?? { ab:0, h:0, doubles:0, triples:0, hr:0, r:0, rbi:0, bb:0, k:0 };
                const singles = Math.max(0, s.h - s.doubles - s.triples - s.hr);
                const slg = s.ab > 0
                  ? ((singles + 2*s.doubles + 3*s.triples + 4*s.hr) / s.ab).toFixed(3).replace(/^0/, '')
                  : null;
                void slg; // used only in season stats
                return (
                  <tr key={p.player_id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                    <td className={`px-4 py-2 text-gray-400 text-xs font-mono ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                      {p.batting_slot ?? '—'}
                    </td>
                    <td className={`px-4 py-2 font-medium text-gray-800 whitespace-nowrap ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                      {p.player_name}
                    </td>
                    {STAT_COLS.map(col => (
                      <td key={col.key} className={`px-2 py-2 text-center${col.highlight ? ' bg-gray-100' : ''}`}>
                        <input
                          type="number"
                          min={0}
                          value={s[col.key]}
                          onChange={e => updateStat(p.player_id, col.key, e.target.value)}
                          className={inputCls}
                        />
                      </td>
                    ))}
                    <td className="px-3 py-2 text-center font-mono text-gray-600 text-xs">
                      {avg(s.h, s.ab)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex justify-end mt-4">
        <button
          onClick={saveAll}
          disabled={saving || !dirty}
          className="bg-green-700 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-green-800 disabled:opacity-40 transition-colors"
        >
          {saving ? 'Saving…' : 'Save Stats'}
        </button>
      </div>

      <p className="text-xs text-gray-400 mt-3 text-center">
        Click any number to edit · AVG = H/AB · Changes are not saved until you click Save Stats
      </p>
    </div>
  );
}

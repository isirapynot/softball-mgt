'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Player { id: number; name: string; }

interface Game {
  id: number;
  game_date: string;
  game_time: string;
  opponent: string;
  home_away: 'home' | 'away';
  location: string | null;
}

interface BattingSlot {
  batting_slot: number;
  player_id: number;
  player_name: string;
}

// { [inning]: { [position]: player_id } }
type FieldingLineup = Record<number, Record<string, number>>;

type AvailStatus = 'yes' | 'no' | 'maybe';
type AvailMap = Record<number, AvailStatus>; // player_id -> status

const AVAIL_ICON: Record<AvailStatus, string> = { yes: '✅', maybe: '❓', no: '❌' };
const AVAIL_LABEL: Record<AvailStatus, string> = { yes: 'In', maybe: 'Maybe', no: 'Out' };
const AVAIL_COLOR: Record<AvailStatus, string> = {
  yes:   'bg-green-100 text-green-700',
  maybe: 'bg-yellow-100 text-yellow-700',
  no:    'bg-red-100 text-red-600',
};

// ── Constants ──────────────────────────────────────────────────────────────────

const POSITIONS = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'LC', 'RC', 'RF'] as const;
type Position = typeof POSITIONS[number];
const DEFAULT_INNINGS = 7;

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDate(d: string) {
  const s = String(d).substring(0, 10);
  const [y, m, day] = s.split('-').map(Number);
  return new Date(y, m - 1, day).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });
}
function formatTime(t: string) {
  const [h, m] = t.split(':');
  const hr = parseInt(h);
  return `${hr % 12 || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`;
}

/** Returns { player_id -> { inning -> position } } from fielding state */
function invertFielding(fielding: FieldingLineup): Record<number, Record<number, string>> {
  const out: Record<number, Record<number, string>> = {};
  for (const [inning, positions] of Object.entries(fielding)) {
    for (const [pos, pid] of Object.entries(positions)) {
      if (!out[pid]) out[pid] = {};
      out[pid][Number(inning)] = pos;
    }
  }
  return out;
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function LineupPage({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = use(params);
  const router = useRouter();

  const [game, setGame]               = useState<Game | null>(null);
  const [allGames, setAllGames]       = useState<Game[]>([]);
  const [players, setPlayers]         = useState<Player[]>([]);
  const [battingOrder, setBattingOrder] = useState<BattingSlot[]>([]);
  const [fielding, setFielding]       = useState<FieldingLineup>({});
  const [numInnings, setNumInnings]   = useState(DEFAULT_INNINGS);
  const [saving, setSaving]           = useState(false);
  const [availMap, setAvailMap]       = useState<AvailMap>({});

  // Copy-from-game panel state
  const [showCopyPanel, setShowCopyPanel] = useState(false);
  const [copyFromId, setCopyFromId]       = useState('');
  const [copying, setCopying]             = useState(false);

  // ── Load ─────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    const [gRes, pRes, lRes, aRes] = await Promise.all([
      fetch('/api/games'),
      fetch('/api/players'),
      fetch(`/api/lineup?game_id=${gameId}`),
      fetch(`/api/availability?game_id=${gameId}`),
    ]);
    if (gRes.status === 401) { router.push('/admin/login'); return; }

    const games: Game[] = await gRes.json();
    setAllGames(games);
    setGame(games.find((g) => g.id === Number(gameId)) ?? null);
    setPlayers(await pRes.json());

    const { battingOrder: bo, fieldingLineup: fl } = await lRes.json();
    setBattingOrder(bo ?? []);
    setFielding(fl ?? {});

    // Build availability map: player_id -> status
    const availRows: { player_id: number; status: AvailStatus }[] = await aRes.json();
    const aMap: AvailMap = {};
    for (const row of availRows) aMap[row.player_id] = row.status;
    setAvailMap(aMap);

    const existingInnings = Object.keys(fl ?? {}).map(Number);
    if (existingInnings.length > 0)
      setNumInnings(Math.max(...existingInnings, DEFAULT_INNINGS));
  }, [gameId, router]);

  useEffect(() => { load(); }, [load]);

  // ── Batting order ─────────────────────────────────────────────────────────

  async function saveBattingOrder(order: BattingSlot[]) {
    setSaving(true);
    await fetch('/api/lineup/batting', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        game_id: Number(gameId),
        order: order.map((s) => ({ player_id: s.player_id, batting_slot: s.batting_slot })),
      }),
    });
    setSaving(false);
  }

  function addBatter(player_id: number) {
    if (battingOrder.some((s) => s.player_id === player_id)) return;
    const player = players.find((p) => p.id === player_id);
    if (!player) return;
    const newOrder = [
      ...battingOrder,
      { batting_slot: battingOrder.length + 1, player_id, player_name: player.name },
    ];
    setBattingOrder(newOrder);
    saveBattingOrder(newOrder);
  }

  function removeBatter(player_id: number) {
    const newOrder = battingOrder
      .filter((s) => s.player_id !== player_id)
      .map((s, i) => ({ ...s, batting_slot: i + 1 }));
    setBattingOrder(newOrder);
    saveBattingOrder(newOrder);
  }

  function moveBatter(from: number, to: number) {
    const arr = [...battingOrder];
    const [item] = arr.splice(from, 1);
    arr.splice(to, 0, item);
    const newOrder = arr.map((s, i) => ({ ...s, batting_slot: i + 1 }));
    setBattingOrder(newOrder);
    saveBattingOrder(newOrder);
  }

  function rotateToTop(idx: number) {
    // Slice at idx and wrap the front to the back: [4,5,6,7,8,9,1,2,3]
    const arr = [...battingOrder];
    const rotated = [...arr.slice(idx), ...arr.slice(0, idx)];
    const newOrder = rotated.map((s, i) => ({ ...s, batting_slot: i + 1 }));
    setBattingOrder(newOrder);
    saveBattingOrder(newOrder);
  }

  // ── Fielding ──────────────────────────────────────────────────────────────

  /**
   * Assign a player to a position for an inning.
   * position = '' means "remove this player from their current position".
   */
  async function setCell(inning: number, player_id: number, newPosition: Position | '') {
    const playerPositions = invertFielding(fielding);
    const oldPosition = playerPositions[player_id]?.[inning];

    // Optimistic update
    setFielding((prev) => {
      const next = structuredClone(prev) as FieldingLineup;
      if (!next[inning]) next[inning] = {};

      // Remove player from their old spot
      if (oldPosition) delete next[inning][oldPosition];

      if (newPosition) {
        // Evict whoever was already at the new position
        if (next[inning][newPosition]) delete next[inning][newPosition];
        next[inning][newPosition] = player_id;
      }
      return next;
    });

    if (newPosition) {
      await fetch('/api/lineup/fielding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game_id: Number(gameId), inning, position: newPosition, player_id }),
      });
    } else if (oldPosition) {
      // Clear the old position
      await fetch('/api/lineup/fielding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game_id: Number(gameId), inning, position: oldPosition, player_id: null }),
      });
    }
  }

  async function clearInning(inning: number) {
    setFielding((prev) => { const n = { ...prev }; delete n[inning]; return n; });
    await fetch('/api/lineup/fielding', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game_id: Number(gameId), inning }),
    });
  }

  async function copyInning(fromInning: number, toInning: number) {
    const source = fielding[fromInning] ?? {};
    const newInning: Record<string, number> = { ...source };

    // Clear then repopulate
    await fetch('/api/lineup/fielding', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game_id: Number(gameId), inning: toInning }),
    });
    for (const [pos, pid] of Object.entries(source)) {
      await fetch('/api/lineup/fielding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game_id: Number(gameId), inning: toInning, position: pos, player_id: pid }),
      });
    }
    setFielding((prev) => ({ ...prev, [toInning]: newInning }));
  }

  // ── Copy from another game ────────────────────────────────────────────────

  async function copyFromGame() {
    if (!copyFromId) return;
    if (!confirm(
      `This will replace the entire batting order and all fielding positions for this game.\n\nCopy lineup from that game?`
    )) return;

    setCopying(true);
    const res = await fetch('/api/lineup/copy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source_game_id: Number(copyFromId), target_game_id: Number(gameId) }),
    });
    setCopying(false);

    if (res.ok) {
      setShowCopyPanel(false);
      setCopyFromId('');
      await load(); // Reload the freshly copied lineup
    }
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const battingPlayerIds = new Set(battingOrder.map((s) => s.player_id));
  const notInOrder = players.filter((p) => !battingPlayerIds.has(p.id));
  const playerPositions = invertFielding(fielding); // player_id -> inning -> position
  const innings = Array.from({ length: numInnings }, (_, i) => i + 1);

  if (!game) return <div className="text-center py-20 text-gray-400">Loading…</div>;

  return (
    <div>
      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <Link href="/admin/schedule" className="text-sm text-green-700 hover:underline mb-1 inline-block">
            ← Back to Schedule
          </Link>
          <h1 className="text-2xl font-bold text-gray-800">Lineup — vs {game.opponent}</h1>
          <p className="text-sm text-gray-500">
            {formatDate(game.game_date)} · {formatTime(game.game_time)}
            {game.location && ` · ${game.location}`}
          </p>
        </div>
        <div className="flex items-center gap-3 self-start mt-1">
          {saving && <span className="text-sm text-gray-400 animate-pulse">Saving…</span>}
          <button
            onClick={() => { setShowCopyPanel((v) => !v); setCopyFromId(''); }}
            className="flex items-center gap-1.5 text-sm border border-gray-300 rounded-lg px-3 py-1.5 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <span>📋</span> Copy from game
          </button>
        </div>
      </div>

      {/* ── Copy-from-game panel ──────────────────────────────────────────── */}
      {showCopyPanel && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-wrap items-center gap-3">
          <p className="text-sm font-medium text-amber-800 flex-shrink-0">Copy full lineup from:</p>
          <select
            value={copyFromId}
            onChange={(e) => setCopyFromId(e.target.value)}
            className="flex-1 min-w-[220px] border border-amber-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
          >
            <option value="">— Select a game —</option>
            {allGames
              .filter((g) => g.id !== Number(gameId))
              .map((g) => (
                <option key={g.id} value={g.id}>
                  {formatDate(g.game_date)} vs {g.opponent} ({g.home_away === 'home' ? 'Home' : 'Away'})
                </option>
              ))
            }
          </select>
          <button
            onClick={copyFromGame}
            disabled={!copyFromId || copying}
            className="bg-amber-600 text-white px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-amber-700 disabled:opacity-50 transition-colors"
          >
            {copying ? 'Copying…' : 'Copy lineup'}
          </button>
          <button
            onClick={() => setShowCopyPanel(false)}
            className="text-amber-500 hover:text-amber-700 text-sm"
          >
            Cancel
          </button>
          <p className="w-full text-xs text-amber-600 mt-0.5">
            ⚠️ This will overwrite the current batting order and all fielding positions for this game.
          </p>
        </div>
      )}

      <div className="flex flex-col xl:flex-row gap-6 items-start">

        {/* ── Left: Batting Order ───────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 w-full xl:w-64 flex-shrink-0">
          <h2 className="text-base font-semibold text-gray-700 mb-3">Batting Order</h2>

          <select
            className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-green-500"
            value=""
            onChange={(e) => { if (e.target.value) addBatter(Number(e.target.value)); }}
          >
            <option value="">+ Add player…</option>
            {notInOrder.map((p) => {
              const s = availMap[p.id];
              const icon = s ? AVAIL_ICON[s] : '◌';
              return <option key={p.id} value={p.id}>{icon} {p.name}</option>;
            })}
          </select>

          {battingOrder.length === 0
            ? <p className="text-sm text-gray-400 text-center py-3">No batters yet.</p>
            : (
              <ol className="space-y-1">
                {battingOrder.map((slot, idx) => (
                  <li key={slot.player_id} className="flex items-center gap-1.5 group">
                    {/* Slot number / TOP badge */}
                    <span className="w-5 text-right text-xs font-mono flex-shrink-0">
                      {idx === 0
                        ? <span className="text-green-600 font-bold">①</span>
                        : <span className="text-gray-400">{slot.batting_slot}.</span>
                      }
                    </span>

                    {/* Player name + availability badge */}
                    <span className={`flex-1 flex items-center gap-1.5 text-sm font-medium rounded px-2 py-1 min-w-0 ${
                      idx === 0 ? 'bg-green-50 text-green-900' : 'bg-gray-50 text-gray-800'
                    }`}>
                      <span className="truncate">{slot.player_name}</span>
                      {availMap[slot.player_id] && (
                        <span className={`flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${AVAIL_COLOR[availMap[slot.player_id]]}`}>
                          {AVAIL_ICON[availMap[slot.player_id]]} {AVAIL_LABEL[availMap[slot.player_id]]}
                        </span>
                      )}
                    </span>

                    {/* Action buttons (visible on hover) */}
                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      {/* Rotate to top — only show for idx > 0 */}
                      {idx > 0 && (
                        <button
                          onClick={() => rotateToTop(idx)}
                          title={`Start order from ${slot.player_name} (wrap ${idx} to end)`}
                          className="text-indigo-400 hover:text-indigo-700 text-[10px] font-bold w-7 h-5 flex items-center justify-center rounded hover:bg-indigo-50"
                        >→①</button>
                      )}
                      <button onClick={() => idx > 0 && moveBatter(idx, idx - 1)} disabled={idx === 0}
                        className="text-gray-400 hover:text-gray-700 disabled:opacity-20 text-xs w-5 h-5 flex items-center justify-center">▲</button>
                      <button onClick={() => idx < battingOrder.length - 1 && moveBatter(idx, idx + 1)} disabled={idx === battingOrder.length - 1}
                        className="text-gray-400 hover:text-gray-700 disabled:opacity-20 text-xs w-5 h-5 flex items-center justify-center">▼</button>
                      <button onClick={() => removeBatter(slot.player_id)}
                        className="text-red-400 hover:text-red-600 text-xs w-5 h-5 flex items-center justify-center">✕</button>
                    </div>
                  </li>
                ))}
              </ol>
            )
          }
          {battingOrder.length > 0 && (
            <p className="text-xs text-gray-400 mt-3 border-t border-gray-100 pt-2">
              {battingOrder.length} player{battingOrder.length !== 1 ? 's' : ''} in order
            </p>
          )}
        </div>

        {/* ── Right: Grid (players × innings) ──────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex-1 min-w-0">
          <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
            <h2 className="text-base font-semibold text-gray-700">Fielding by Inning</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setNumInnings((n) => n + 1)}
                className="text-xs text-green-700 border border-green-300 px-2.5 py-1 rounded-lg hover:bg-green-50"
              >+ Inning</button>
              {numInnings > 1 && (
                <button
                  onClick={() => setNumInnings((n) => n - 1)}
                  className="text-xs text-gray-500 border border-gray-300 px-2.5 py-1 rounded-lg hover:bg-gray-50"
                >− Inning</button>
              )}
            </div>
          </div>

          {battingOrder.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">
              Add players to the batting order first.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="border-collapse text-sm w-full">
                <thead>
                  <tr>
                    {/* Player column header */}
                    <th className="text-left pr-3 pb-2 font-semibold text-gray-500 text-xs uppercase tracking-wide whitespace-nowrap sticky left-0 bg-white z-10">
                      # Player
                    </th>
                    {/* Inning headers */}
                    {innings.map((n) => {
                      const filled = Object.keys(fielding[n] ?? {}).length;
                      const complete = filled === 10;
                      const partial = filled > 0 && filled < 10;
                      return (
                        <th key={n} className="pb-2 px-1 min-w-[72px]">
                          <div className="flex flex-col items-center gap-1">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                              complete ? 'bg-green-100 text-green-700'
                                : partial ? 'bg-yellow-100 text-yellow-700'
                                : 'text-gray-500'
                            }`}>
                              Inn {n}
                            </span>
                            <span className="text-[10px] text-gray-400">{filled}/10</span>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {battingOrder.map((slot) => {
                    const myPositions = playerPositions[slot.player_id] ?? {};
                    return (
                      <tr key={slot.player_id} className="hover:bg-gray-50/60">
                        {/* Player name + availability */}
                        <td className="pr-3 py-1.5 whitespace-nowrap sticky left-0 bg-white z-10">
                          <span className="text-xs text-gray-400 font-mono mr-1">{slot.batting_slot}.</span>
                          <span className="font-medium text-gray-800 text-sm">{slot.player_name}</span>
                          {availMap[slot.player_id] ? (
                            <span className={`ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${AVAIL_COLOR[availMap[slot.player_id]]}`}>
                              {AVAIL_ICON[availMap[slot.player_id]]} {AVAIL_LABEL[availMap[slot.player_id]]}
                            </span>
                          ) : (
                            <span className="ml-1.5 text-[10px] text-gray-300">no reply</span>
                          )}
                        </td>
                        {/* Position cell per inning */}
                        {innings.map((inning) => {
                          const currentPos = myPositions[inning] as Position | undefined;
                          const takenInInning = fielding[inning] ?? {};
                          return (
                            <td key={inning} className="px-1 py-1.5">
                              <PositionSelect
                                value={currentPos ?? ''}
                                takenPositions={takenInInning}
                                playerId={slot.player_id}
                                onChange={(pos) => setCell(inning, slot.player_id, pos)}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>

                {/* Footer: copy / clear per inning */}
                <tfoot>
                  <tr>
                    <td className="pt-2 sticky left-0 bg-white z-10" />
                    {innings.map((n) => (
                      <td key={n} className="pt-2 px-1">
                        <div className="flex flex-col gap-1 items-center">
                          {n > 1 && (
                            <button
                              onClick={() => copyInning(n - 1, n)}
                              title={`Copy inning ${n - 1} → ${n}`}
                              className="text-[10px] text-blue-600 hover:text-blue-800 hover:underline whitespace-nowrap"
                            >
                              ← Copy {n - 1}
                            </button>
                          )}
                          {Object.keys(fielding[n] ?? {}).length > 0 && (
                            <button
                              onClick={() => clearInning(n)}
                              title={`Clear inning ${n}`}
                              className="text-[10px] text-red-400 hover:text-red-600 hover:underline"
                            >
                              Clear
                            </button>
                          )}
                        </div>
                      </td>
                    ))}
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Legend */}
          <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-sm bg-green-100 border border-green-300" /> Position assigned
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-sm bg-orange-50 border border-orange-200" /> Sitting out
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-400" /> Inning complete
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-yellow-400" /> Inning partial
            </span>
            <span className="text-gray-300">|</span>
            <span className="flex items-center gap-1">✅ <span className="text-green-700">In</span></span>
            <span className="flex items-center gap-1">❓ <span className="text-yellow-700">Maybe</span></span>
            <span className="flex items-center gap-1">❌ <span className="text-red-600">Out</span></span>
            <span className="flex items-center gap-1">◌ No reply</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── PositionSelect cell ────────────────────────────────────────────────────────

const POSITION_GROUPS = [
  { label: 'Battery',  positions: ['P', 'C'] },
  { label: 'Infield',  positions: ['1B', '2B', '3B', 'SS'] },
  { label: 'Outfield', positions: ['LF', 'LC', 'RC', 'RF'] },
] as const;

function PositionSelect({
  value,
  takenPositions,
  playerId,
  onChange,
}: {
  value: Position | '';
  takenPositions: Record<string, number>;
  playerId: number;
  onChange: (pos: Position | '') => void;
}) {
  const hasValue = value !== '';

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as Position | '')}
      className={`w-[68px] text-xs rounded-md border px-1 py-1 focus:outline-none focus:ring-2 focus:ring-green-400 cursor-pointer transition-colors ${
        hasValue
          ? 'bg-green-50 border-green-300 text-green-800 font-semibold'
          : 'bg-orange-50/60 border-gray-200 text-gray-400'
      }`}
    >
      <option value="">— out —</option>
      {POSITION_GROUPS.map(({ label, positions }) => (
        <optgroup key={label} label={label}>
          {positions.map((pos) => {
            const takenBy = takenPositions[pos];
            const takenByOther = takenBy !== undefined && takenBy !== playerId;
            return (
              <option key={pos} value={pos} disabled={takenByOther}>
                {pos}{takenByOther ? ' ✗' : ''}
              </option>
            );
          })}
        </optgroup>
      ))}
    </select>
  );
}

'use client';

import { useState } from 'react';
import Link from 'next/link';

export interface GameSummary {
  game_id: number;
  game_date: string;
  game_time: string;
  opponent: string;
  home_away: 'home' | 'away';
  location: string | null;
  yes_count: number;
  no_count: number;
  maybe_count: number;
  lineup_count: number;
}

interface BattingRow {
  batting_slot: number;
  player_id: number;
  player_name: string;
}

interface AvailEntry {
  player_id: number;
  status: 'yes' | 'no' | 'maybe';
}

interface LineupData {
  battingOrder: BattingRow[];
  fieldingLineup: Record<number, Record<string, number>>;
}

function toDateStr(val: string | Date): string {
  return (val instanceof Date ? val.toISOString() : String(val)).substring(0, 10);
}

function formatDate(dateStr: string | Date) {
  const [year, month, day] = toDateStr(dateStr).split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(timeStr: string) {
  const [h, m] = timeStr.split(':');
  const hour = parseInt(h);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

/** Invert {inning → {position → player_id}} to {player_id → {inning → position}} */
function invertFielding(
  fielding: Record<number, Record<string, number>>
): Record<number, Record<number, string>> {
  const result: Record<number, Record<number, string>> = {};
  for (const [inningStr, positions] of Object.entries(fielding)) {
    const inning = Number(inningStr);
    for (const [position, playerId] of Object.entries(positions)) {
      if (!result[playerId]) result[playerId] = {};
      result[playerId][inning] = position;
    }
  }
  return result;
}

const AVAIL_ICON: Record<string, string> = { yes: '✅', maybe: '❓', no: '❌' };
const AVAIL_COLOR: Record<string, string> = {
  yes: 'text-green-600',
  maybe: 'text-yellow-500',
  no: 'text-red-500',
};

export default function GameCard({ game }: { game: GameSummary }) {
  const [expanded, setExpanded] = useState(false);
  const [lineup, setLineup] = useState<LineupData | null>(null);
  const [availMap, setAvailMap] = useState<Record<number, 'yes' | 'no' | 'maybe'>>({});
  const [loading, setLoading] = useState(false);

  async function handleExpand() {
    const next = !expanded;
    setExpanded(next);
    if (next && !lineup) {
      setLoading(true);
      try {
        const [lineupRes, availRes] = await Promise.all([
          fetch(`/api/lineup?game_id=${game.game_id}`),
          fetch(`/api/availability?game_id=${game.game_id}`),
        ]);
        const lineupData: LineupData = await lineupRes.json();
        const availData: AvailEntry[] = await availRes.json();
        setLineup(lineupData);
        const map: Record<number, 'yes' | 'no' | 'maybe'> = {};
        for (const a of availData) map[a.player_id] = a.status;
        setAvailMap(map);
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }
  }

  const innings = lineup
    ? Object.keys(lineup.fieldingLineup).map(Number).sort((a, b) => a - b)
    : [];
  const playerPositions = lineup ? invertFielding(lineup.fieldingLineup) : {};

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Main card row */}
      <div className="p-4 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                game.home_away === 'home'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-blue-100 text-blue-800'
              }`}
            >
              {game.home_away === 'home' ? 'HOME' : 'AWAY'}
            </span>
            <span className="font-semibold text-gray-800">vs {game.opponent}</span>
          </div>
          <p className="text-sm text-gray-500">
            {formatDate(game.game_date)} &middot; {formatTime(game.game_time)}
            {game.location && ` · ${game.location}`}
          </p>
        </div>

        <div className="flex items-center gap-4">
          {/* Availability counts */}
          <div className="flex gap-4 text-sm">
            <span className="flex flex-col items-center">
              <span className="text-lg font-bold text-green-600">{game.yes_count}</span>
              <span className="text-xs text-gray-400">In</span>
            </span>
            <span className="flex flex-col items-center">
              <span className="text-lg font-bold text-yellow-500">{game.maybe_count}</span>
              <span className="text-xs text-gray-400">Maybe</span>
            </span>
            <span className="flex flex-col items-center">
              <span className="text-lg font-bold text-red-500">{game.no_count}</span>
              <span className="text-xs text-gray-400">Out</span>
            </span>
          </div>

          {/* Expand button — only when lineup exists */}
          {game.lineup_count > 0 && (
            <button
              onClick={handleExpand}
              className="flex items-center gap-1 text-xs font-medium text-green-700 hover:text-green-900 border border-green-200 hover:border-green-400 rounded-lg px-3 py-1.5 transition-colors whitespace-nowrap"
              title={expanded ? 'Hide lineup' : 'Show lineup'}
            >
              ⚾ {game.lineup_count} batters
              <span className="ml-1">{expanded ? '▲' : '▼'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Expandable lineup section */}
      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50 px-4 py-4">
          {loading ? (
            <p className="text-sm text-gray-400 text-center py-4">Loading lineup…</p>
          ) : lineup ? (
            <>
              {/* Action links */}
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Batting Order &amp; Fielding
                </h3>
                <div className="flex gap-3">
                  <Link
                    href={`/admin/lineup/${game.game_id}`}
                    className="text-xs text-green-700 hover:underline"
                  >
                    Edit lineup →
                  </Link>
                  <Link
                    href={`/lineup/${game.game_id}/print`}
                    target="_blank"
                    className="text-xs bg-gray-700 text-white px-2.5 py-1 rounded hover:bg-gray-800 transition-colors"
                  >
                    🖨️ Print
                  </Link>
                </div>
              </div>

              {/* Lineup table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="text-left px-2 py-1.5 text-xs font-semibold text-gray-500 w-8">#</th>
                      <th className="text-left px-2 py-1.5 text-xs font-semibold text-gray-500">Player</th>
                      <th className="text-center px-2 py-1.5 text-xs font-semibold text-gray-500 w-10">Avail</th>
                      {innings.map((inn) => (
                        <th
                          key={inn}
                          className="text-center px-2 py-1.5 text-xs font-semibold text-gray-500 w-12"
                        >
                          Inn {inn}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {lineup.battingOrder.map((batter, i) => {
                      const avail = availMap[batter.player_id];
                      const positions = playerPositions[batter.player_id] ?? {};
                      return (
                        <tr
                          key={batter.player_id}
                          className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                        >
                          <td className="px-2 py-1.5 text-xs text-gray-400 font-mono text-right">
                            {batter.batting_slot}.
                          </td>
                          <td className="px-2 py-1.5 font-medium text-gray-800">
                            {batter.player_name}
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            {avail ? (
                              <span
                                className={`text-sm ${AVAIL_COLOR[avail]}`}
                                title={avail}
                              >
                                {AVAIL_ICON[avail]}
                              </span>
                            ) : (
                              <span className="text-gray-300 text-xs">—</span>
                            )}
                          </td>
                          {innings.map((inn) => (
                            <td
                              key={inn}
                              className="px-2 py-1.5 text-center text-xs font-mono text-gray-700"
                            >
                              {positions[inn] ?? (
                                <span className="text-gray-200">—</span>
                              )}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-400 text-center py-2">Could not load lineup.</p>
          )}
        </div>
      )}
    </div>
  );
}

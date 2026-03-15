import { notFound } from 'next/navigation';
import pool from '@/lib/db';
import PrintTrigger from './PrintTrigger';

interface Props {
  params: Promise<{ gameId: string }>;
}

interface GameRow {
  id: number;
  game_date: string | Date;
  game_time: string;
  opponent: string;
  home_away: 'home' | 'away';
  location: string | null;
}

interface BattingRow {
  batting_slot: number;
  player_id: number;
  player_name: string;
}

interface FieldingRow {
  inning: number;
  position: string;
  player_id: number;
}

function toDateStr(val: string | Date): string {
  return (val instanceof Date ? val.toISOString() : String(val)).substring(0, 10);
}

function formatDate(val: string | Date) {
  const [year, month, day] = toDateStr(val).split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function formatTime(timeStr: string) {
  const [h, m] = timeStr.split(':');
  const hour = parseInt(h);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

export default async function PrintLineupPage({ params }: Props) {
  const { gameId } = await params;
  const id = Number(gameId);
  if (isNaN(id)) notFound();

  const [[gameRows], [battingRows], [fieldingRows]] = await Promise.all([
    pool.query<never[]>('SELECT * FROM games WHERE id = ?', [id]),
    pool.query<never[]>(
      `SELECT bo.batting_slot, bo.player_id, p.name as player_name
       FROM batting_orders bo
       JOIN players p ON bo.player_id = p.id
       WHERE bo.game_id = ?
       ORDER BY bo.batting_slot ASC`,
      [id]
    ),
    pool.query<never[]>(
      'SELECT inning, position, player_id FROM fielding_lineup WHERE game_id = ? ORDER BY inning ASC',
      [id]
    ),
  ]);

  if (!gameRows.length) notFound();

  const game = (gameRows as GameRow[])[0];
  const batters = battingRows as BattingRow[];
  const fielding = fieldingRows as FieldingRow[];

  // {inning → {position → player_id}} then invert to {player_id → {inning → position}}
  const fieldingByInning: Record<number, Record<string, number>> = {};
  for (const row of fielding) {
    if (!fieldingByInning[row.inning]) fieldingByInning[row.inning] = {};
    fieldingByInning[row.inning][row.position] = row.player_id;
  }
  const playerPositions: Record<number, Record<number, string>> = {};
  for (const [inningStr, positions] of Object.entries(fieldingByInning)) {
    const inning = Number(inningStr);
    for (const [position, playerId] of Object.entries(positions)) {
      if (!playerPositions[playerId]) playerPositions[playerId] = {};
      playerPositions[playerId][inning] = position;
    }
  }

  const innings = Object.keys(fieldingByInning).map(Number).sort((a, b) => a - b);

  return (
    <>
      <PrintTrigger />

      <style>{`
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        @media print {
          body { margin: 0; }
          .no-print { display: none !important; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; }
        }
        @page { margin: 0.75in; }
        .lineup-table { border-collapse: collapse; width: 100%; }
        .lineup-table th,
        .lineup-table td { border: 1px solid #9ca3af; padding: 6px 10px; }
        .lineup-table thead tr { background-color: #1e3a2f !important; color: #ffffff !important; }
        .lineup-table thead th { font-weight: 700; letter-spacing: 0.03em; }
        .lineup-table tbody tr:nth-child(even) { background-color: #e9f5ee !important; }
        .lineup-table tbody tr:nth-child(odd)  { background-color: #ffffff !important; }
        .lineup-table tbody tr:hover { background-color: #d1fae5 !important; }
        .lineup-table td.pos-cell { text-align: center; font-family: monospace; font-weight: 600; font-size: 0.78rem; color: #1f2937; }
        .lineup-table td.num-cell { text-align: right; color: #6b7280; font-family: monospace; width: 2rem; }
        .lineup-table td.name-cell { font-weight: 600; color: #111827; }
      `}</style>

      <div className="max-w-4xl mx-auto p-6 font-sans">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              ⚾ vs {game.opponent}
            </h1>
            <p className="text-gray-600 mt-1">
              {formatDate(game.game_date)} &middot; {formatTime(game.game_time)}
              {game.location && ` · ${game.location}`}
            </p>
            <p className="text-sm font-semibold mt-0.5">
              <span
                className={`inline-block px-2 py-0.5 rounded text-xs uppercase tracking-wide ${
                  game.home_away === 'home'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-blue-100 text-blue-800'
                }`}
              >
                {game.home_away}
              </span>
            </p>
          </div>
          <PrintTrigger />
        </div>

        {batters.length === 0 ? (
          <p className="text-gray-500">No batting order set for this game.</p>
        ) : (
          <table className="lineup-table text-sm">
            <thead>
              <tr>
                <th style={{ textAlign: 'right', width: '2rem' }}>#</th>
                <th style={{ textAlign: 'left' }}>Player</th>
                {innings.map((inn) => (
                  <th key={inn} style={{ textAlign: 'center', width: '3.5rem' }}>
                    Inn {inn}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {batters.map((batter) => {
                const positions = playerPositions[batter.player_id] ?? {};
                return (
                  <tr key={batter.player_id}>
                    <td className="num-cell">{batter.batting_slot}.</td>
                    <td className="name-cell">{batter.player_name}</td>
                    {innings.map((inn) => (
                      <td key={inn} className="pos-cell">
                        {positions[inn] ?? ''}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        <p className="no-print mt-6 text-xs text-gray-400 text-center">
          Softball MGT · {new Date().toLocaleDateString()}
        </p>
      </div>
    </>
  );
}

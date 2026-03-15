import Link from 'next/link';
import pool from '@/lib/db';
import GameCard, { type GameSummary } from '@/components/GameCard';

function toDateStr(val: string | Date): string {
  return (val instanceof Date ? val.toISOString() : String(val)).substring(0, 10);
}

export default async function Dashboard() {
  let games: GameSummary[] = [];

  try {
    const [rows] = await pool.query<never[]>(
      `SELECT
         g.id as game_id,
         g.game_date,
         g.game_time,
         g.opponent,
         g.home_away,
         g.location,
         COALESCE(SUM(CASE WHEN a.status = 'yes' THEN 1 ELSE 0 END), 0) as yes_count,
         COALESCE(SUM(CASE WHEN a.status = 'no' THEN 1 ELSE 0 END), 0) as no_count,
         COALESCE(SUM(CASE WHEN a.status = 'maybe' THEN 1 ELSE 0 END), 0) as maybe_count,
         (SELECT COUNT(*) FROM batting_orders bo WHERE bo.game_id = g.id) as lineup_count
       FROM games g
       LEFT JOIN availability a ON g.id = a.game_id
       GROUP BY g.id
       ORDER BY g.game_date ASC, g.game_time ASC`
    );
    games = rows as GameSummary[];
  } catch {
    // DB not connected yet — show empty state
  }

  const today = new Date().toISOString().split('T')[0];
  const upcoming = games.filter((g) => toDateStr(g.game_date) >= today);
  const past = games.filter((g) => toDateStr(g.game_date) < today);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Team Dashboard</h1>
        <div className="flex gap-2">
          <Link
            href="/availability"
            className="bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-800 transition-colors"
          >
            Enter My Availability
          </Link>
          <Link
            href="/admin/login"
            className="bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            Admin
          </Link>
        </div>
      </div>

      {games.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-5xl mb-4">⚾</p>
          <p className="text-lg font-medium">No games scheduled yet.</p>
          <p className="text-sm mt-1">
            <Link href="/admin/schedule" className="text-green-700 hover:underline">
              Add your first game →
            </Link>
          </p>
        </div>
      ) : (
        <>
          {upcoming.length > 0 && (
            <section className="mb-8">
              <h2 className="text-lg font-semibold text-gray-700 mb-3">Upcoming Games</h2>
              <div className="space-y-3">
                {upcoming.map((g) => (
                  <GameCard key={g.game_id} game={g} />
                ))}
              </div>
            </section>
          )}
          {past.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-gray-500 mb-3">Past Games</h2>
              <div className="space-y-2 opacity-60">
                {past.map((g) => (
                  <GameCard key={g.game_id} game={g} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

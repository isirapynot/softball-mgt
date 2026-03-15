import pool from '@/lib/db';
import Link from 'next/link';

interface SeasonRow {
  player_id: number;
  player_name: string;
  games: number;
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

function fmt(n: number | string) {
  return Number(n);
}

function batting(h: number, ab: number) {
  if (ab === 0) return '—';
  return (h / ab).toFixed(3).replace(/^0/, '');
}

function obp(h: number, bb: number, ab: number) {
  const denom = ab + bb;
  if (denom === 0) return '—';
  return ((h + bb) / denom).toFixed(3).replace(/^0/, '');
}

function slg(h: number, doubles: number, triples: number, hr: number, ab: number) {
  if (ab === 0) return '—';
  const singles = Math.max(0, h - doubles - triples - hr);
  return ((singles + 2 * doubles + 3 * triples + 4 * hr) / ab).toFixed(3).replace(/^0/, '');
}

function ops(h: number, doubles: number, triples: number, hr: number, bb: number, ab: number) {
  if (ab === 0) return '—';
  const o = (h + bb) / (ab + bb);
  const singles = Math.max(0, h - doubles - triples - hr);
  const s = (singles + 2 * doubles + 3 * triples + 4 * hr) / ab;
  return (o + s).toFixed(3).replace(/^0/, '');
}

export default async function SeasonStatsPage() {
  let rows: SeasonRow[] = [];

  try {
    const [data] = await pool.query<never[]>(
      `SELECT
         p.id as player_id,
         p.name as player_name,
         COUNT(DISTINCT bs.game_id)  as games,
         COALESCE(SUM(bs.ab), 0)      as ab,
         COALESCE(SUM(bs.h), 0)       as h,
         COALESCE(SUM(bs.doubles), 0) as doubles,
         COALESCE(SUM(bs.triples), 0) as triples,
         COALESCE(SUM(bs.hr), 0)      as hr,
         COALESCE(SUM(bs.r), 0)       as r,
         COALESCE(SUM(bs.rbi), 0)     as rbi,
         COALESCE(SUM(bs.bb), 0)      as bb,
         COALESCE(SUM(bs.k), 0)       as k
       FROM players p
       LEFT JOIN batting_stats bs ON bs.player_id = p.id
       GROUP BY p.id
       HAVING ab > 0
       ORDER BY (SUM(bs.h) / NULLIF(SUM(bs.ab), 0)) DESC, p.name ASC`
    );
    rows = data as SeasonRow[];
  } catch {
    // DB not connected yet
  }

  const thCls = 'px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-center whitespace-nowrap';
  const tdCls = 'px-3 py-2.5 text-center text-sm tabular-nums';
  const tdHighCls = 'px-3 py-2.5 text-center text-sm tabular-nums font-semibold text-gray-800';

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Season Statistics</h1>
        <Link href="/" className="text-sm text-gray-400 hover:text-gray-600">← Dashboard</Link>
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-5xl mb-4">📊</p>
          <p className="text-lg font-medium">No stats recorded yet.</p>
          <p className="text-sm mt-1">
            Stats are entered by the admin after each game.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">Player</th>
                <th className={thCls} title="Games Played">G</th>
                <th className={thCls} title="At Bats">AB</th>
                <th className={thCls} title="Hits">H</th>
                <th className={thCls} title="Doubles">2B</th>
                <th className={thCls} title="Triples">3B</th>
                <th className={thCls} title="Home Runs">HR</th>
                <th className={thCls} title="Runs">R</th>
                <th className={thCls} title="Runs Batted In">RBI</th>
                <th className={thCls} title="Walks">BB</th>
                <th className={thCls} title="Strikeouts">K</th>
                <th className={`${thCls} border-l border-gray-200`} title="Batting Average">AVG</th>
                <th className={thCls} title="On-Base Percentage">OBP</th>
                <th className={thCls} title="Slugging Percentage">SLG</th>
                <th className={thCls} title="On-Base Plus Slugging">OPS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row, i) => {
                const ab = fmt(row.ab);
                const h = fmt(row.h);
                const d = fmt(row.doubles);
                const t = fmt(row.triples);
                const hr = fmt(row.hr);
                const bb = fmt(row.bb);
                return (
                  <tr key={row.player_id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                    <td className="px-4 py-2.5 font-medium text-gray-800 whitespace-nowrap">{row.player_name}</td>
                    <td className={tdCls}>{fmt(row.games)}</td>
                    <td className={tdCls}>{ab}</td>
                    <td className={tdCls}>{h}</td>
                    <td className={tdCls}>{d}</td>
                    <td className={tdCls}>{t}</td>
                    <td className={tdCls}>{hr}</td>
                    <td className={tdCls}>{fmt(row.r)}</td>
                    <td className={tdCls}>{fmt(row.rbi)}</td>
                    <td className={tdCls}>{bb}</td>
                    <td className={tdCls}>{fmt(row.k)}</td>
                    <td className={`${tdHighCls} border-l border-gray-200`}>{batting(h, ab)}</td>
                    <td className={tdHighCls}>{obp(h, bb, ab)}</td>
                    <td className={tdHighCls}>{slg(h, d, t, hr, ab)}</td>
                    <td className={tdHighCls}>{ops(h, d, t, hr, bb, ab)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="text-xs text-gray-400 px-4 py-3 border-t border-gray-100">
            {rows.length} player{rows.length !== 1 ? 's' : ''} · Sorted by AVG · OBP = (H+BB)/(AB+BB) · SLG = Total Bases/AB
          </p>
        </div>
      )}
    </div>
  );
}

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

/** Ensure the batting_stats table exists (safe to call on every request) */
async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS batting_stats (
      id INT AUTO_INCREMENT PRIMARY KEY,
      game_id INT NOT NULL,
      player_id INT NOT NULL,
      ab INT NOT NULL DEFAULT 0,
      h INT NOT NULL DEFAULT 0,
      doubles INT NOT NULL DEFAULT 0,
      triples INT NOT NULL DEFAULT 0,
      hr INT NOT NULL DEFAULT 0,
      r INT NOT NULL DEFAULT 0,
      rbi INT NOT NULL DEFAULT 0,
      bb INT NOT NULL DEFAULT 0,
      k INT NOT NULL DEFAULT 0,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_game_player (game_id, player_id),
      FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
      FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
    )
  `);
}

/** GET /api/stats?game_id=X  → all players + their stats for that game
 *  GET /api/stats             → season totals per player (all games)
 */
export async function GET(req: NextRequest) {
  await ensureTable();
  const { searchParams } = new URL(req.url);
  const game_id = searchParams.get('game_id');

  if (game_id) {
    // Per-game: every player with their stats (zeros if none entered yet),
    // sorted by batting order slot then name.
    const [rows] = await pool.query(
      `SELECT
         p.id as player_id,
         p.name as player_name,
         bo.batting_slot,
         COALESCE(bs.ab, 0)      as ab,
         COALESCE(bs.h, 0)       as h,
         COALESCE(bs.doubles, 0) as doubles,
         COALESCE(bs.triples, 0) as triples,
         COALESCE(bs.hr, 0)      as hr,
         COALESCE(bs.r, 0)       as r,
         COALESCE(bs.rbi, 0)     as rbi,
         COALESCE(bs.bb, 0)      as bb,
         COALESCE(bs.k, 0)       as k
       FROM players p
       LEFT JOIN batting_orders bo ON bo.player_id = p.id AND bo.game_id = ?
       LEFT JOIN batting_stats  bs ON bs.player_id = p.id AND bs.game_id = ?
       ORDER BY bo.batting_slot ASC, p.name ASC`,
      [game_id, game_id]
    );
    return NextResponse.json(rows);
  }

  // Season totals: aggregate across all games, only players with at least 1 AB
  const [rows] = await pool.query(
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
  return NextResponse.json(rows);
}

/** POST /api/stats — upsert one player's stats for one game (admin only) */
export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await ensureTable();

  const { game_id, player_id, ab, h, doubles, triples, hr, r, rbi, bb, k } = await req.json();

  if (!game_id || !player_id) {
    return NextResponse.json({ error: 'game_id and player_id are required' }, { status: 400 });
  }

  await pool.query(
    `INSERT INTO batting_stats (game_id, player_id, ab, h, doubles, triples, hr, r, rbi, bb, k)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       ab=VALUES(ab), h=VALUES(h), doubles=VALUES(doubles), triples=VALUES(triples),
       hr=VALUES(hr), r=VALUES(r), rbi=VALUES(rbi), bb=VALUES(bb), k=VALUES(k)`,
    [game_id, player_id,
     ab ?? 0, h ?? 0, doubles ?? 0, triples ?? 0, hr ?? 0,
     r ?? 0, rbi ?? 0, bb ?? 0, k ?? 0]
  );

  return NextResponse.json({ ok: true });
}

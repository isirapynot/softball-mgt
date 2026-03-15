import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requirePlayerOrAdmin } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const game_id = searchParams.get('game_id');

  if (game_id) {
    const [rows] = await pool.query(
      `SELECT a.*, p.name as player_name
       FROM availability a
       JOIN players p ON a.player_id = p.id
       WHERE a.game_id = ?`,
      [game_id]
    );
    return NextResponse.json(rows);
  }

  // Return summary counts per game
  const [rows] = await pool.query(
    `SELECT
       g.id as game_id,
       g.game_date,
       g.game_time,
       g.opponent,
       g.home_away,
       g.location,
       SUM(CASE WHEN a.status = 'yes' THEN 1 ELSE 0 END) as yes_count,
       SUM(CASE WHEN a.status = 'no' THEN 1 ELSE 0 END) as no_count,
       SUM(CASE WHEN a.status = 'maybe' THEN 1 ELSE 0 END) as maybe_count
     FROM games g
     LEFT JOIN availability a ON g.id = a.game_id
     GROUP BY g.id
     ORDER BY g.game_date ASC, g.game_time ASC`
  );
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  if (!(await requirePlayerOrAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { player_id, game_id, status, note } = await req.json();
  if (!player_id || !game_id || !status) {
    return NextResponse.json({ error: 'player_id, game_id, and status are required' }, { status: 400 });
  }

  await pool.query(
    `INSERT INTO availability (player_id, game_id, status, note)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE status=VALUES(status), note=VALUES(note), updated_at=NOW()`,
    [player_id, game_id, status, note || null]
  );
  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

// POST: assign a player to a position for a given inning (upsert by position)
export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { game_id, inning, position, player_id } = await req.json();
  if (!game_id || !inning || !position) {
    return NextResponse.json({ error: 'game_id, inning, position required' }, { status: 400 });
  }

  if (!player_id) {
    // Clear the position
    await pool.query(
      'DELETE FROM fielding_lineup WHERE game_id=? AND inning=? AND position=?',
      [game_id, inning, position]
    );
    return NextResponse.json({ ok: true });
  }

  // Remove this player from any other position in this inning first
  await pool.query(
    'DELETE FROM fielding_lineup WHERE game_id=? AND inning=? AND player_id=?',
    [game_id, inning, player_id]
  );

  // Upsert the position assignment
  await pool.query(
    `INSERT INTO fielding_lineup (game_id, inning, position, player_id)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE player_id=VALUES(player_id)`,
    [game_id, inning, position, player_id]
  );

  return NextResponse.json({ ok: true });
}

// DELETE: copy an inning's lineup to another inning
export async function DELETE(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { game_id, inning } = await req.json();
  if (!game_id || !inning) return NextResponse.json({ error: 'game_id, inning required' }, { status: 400 });

  await pool.query('DELETE FROM fielding_lineup WHERE game_id=? AND inning=?', [game_id, inning]);
  return NextResponse.json({ ok: true });
}

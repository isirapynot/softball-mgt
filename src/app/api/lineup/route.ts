import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

// GET /api/lineup?game_id=X
// Returns { battingOrder: [...], fieldingLineup: { [inning]: { [position]: player_id } } }
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const game_id = searchParams.get('game_id');
  if (!game_id) return NextResponse.json({ error: 'game_id required' }, { status: 400 });

  const [battingRows] = await pool.query(
    `SELECT bo.batting_slot, bo.player_id, p.name as player_name
     FROM batting_orders bo
     JOIN players p ON bo.player_id = p.id
     WHERE bo.game_id = ?
     ORDER BY bo.batting_slot ASC`,
    [game_id]
  );

  const [fieldingRows] = await pool.query(
    `SELECT fl.inning, fl.position, fl.player_id, p.name as player_name
     FROM fielding_lineup fl
     JOIN players p ON fl.player_id = p.id
     WHERE fl.game_id = ?
     ORDER BY fl.inning ASC`,
    [game_id]
  );

  // Group fielding by inning then position
  const fieldingLineup: Record<number, Record<string, number>> = {};
  for (const row of fieldingRows as { inning: number; position: string; player_id: number }[]) {
    if (!fieldingLineup[row.inning]) fieldingLineup[row.inning] = {};
    fieldingLineup[row.inning][row.position] = row.player_id;
  }

  return NextResponse.json({ battingOrder: battingRows, fieldingLineup });
}

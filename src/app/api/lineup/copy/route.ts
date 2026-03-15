import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

// POST /api/lineup/copy
// Body: { source_game_id, target_game_id }
// Copies the full lineup (batting order + all fielding entries) from one game to another.
export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { source_game_id, target_game_id } = await req.json();
  if (!source_game_id || !target_game_id) {
    return NextResponse.json({ error: 'source_game_id and target_game_id are required' }, { status: 400 });
  }
  if (source_game_id === target_game_id) {
    return NextResponse.json({ error: 'Source and target game must be different' }, { status: 400 });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // ── Fetch source lineup ───────────────────────────────────────────────
    const [battingRows] = await conn.query(
      'SELECT player_id, batting_slot FROM batting_orders WHERE game_id = ? ORDER BY batting_slot ASC',
      [source_game_id]
    ) as [{ player_id: number; batting_slot: number }[], unknown];

    const [fieldingRows] = await conn.query(
      'SELECT inning, position, player_id FROM fielding_lineup WHERE game_id = ? ORDER BY inning ASC',
      [source_game_id]
    ) as [{ inning: number; position: string; player_id: number }[], unknown];

    // ── Clear target lineup ───────────────────────────────────────────────
    await conn.query('DELETE FROM batting_orders WHERE game_id = ?', [target_game_id]);
    await conn.query('DELETE FROM fielding_lineup WHERE game_id = ?', [target_game_id]);

    // ── Write batting order ───────────────────────────────────────────────
    for (const row of battingRows) {
      await conn.query(
        'INSERT INTO batting_orders (game_id, player_id, batting_slot) VALUES (?, ?, ?)',
        [target_game_id, row.player_id, row.batting_slot]
      );
    }

    // ── Write fielding lineup ─────────────────────────────────────────────
    for (const row of fieldingRows) {
      await conn.query(
        'INSERT INTO fielding_lineup (game_id, inning, position, player_id) VALUES (?, ?, ?, ?)',
        [target_game_id, row.inning, row.position, row.player_id]
      );
    }

    await conn.commit();
    return NextResponse.json({
      ok: true,
      copied: { batting_slots: battingRows.length, fielding_entries: fieldingRows.length },
    });
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

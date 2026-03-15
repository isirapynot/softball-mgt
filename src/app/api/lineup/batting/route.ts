import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

// POST: upsert a batting slot. Replaces the whole batting order for the game.
export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { game_id, order } = await req.json();
  // order: Array<{ player_id: number, batting_slot: number }>
  if (!game_id || !Array.isArray(order)) {
    return NextResponse.json({ error: 'game_id and order[] required' }, { status: 400 });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('DELETE FROM batting_orders WHERE game_id = ?', [game_id]);
    for (const { player_id, batting_slot } of order) {
      await conn.query(
        'INSERT INTO batting_orders (game_id, player_id, batting_slot) VALUES (?, ?, ?)',
        [game_id, player_id, batting_slot]
      );
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }

  return NextResponse.json({ ok: true });
}

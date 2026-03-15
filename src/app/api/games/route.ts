import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

/** Add the season column to games if this is an existing DB without it */
async function ensureSeasonColumn() {
  try {
    await pool.query('ALTER TABLE games ADD COLUMN season VARCHAR(50) DEFAULT NULL');
  } catch {
    // Column already exists — ignore
  }
}

export async function GET() {
  await ensureSeasonColumn();
  const [rows] = await pool.query('SELECT * FROM games ORDER BY game_date ASC, game_time ASC');
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  await ensureSeasonColumn();
  const { game_date, game_time, opponent, location, home_away, notes, season } = await req.json();
  if (!game_date || !game_time || !opponent) {
    return NextResponse.json({ error: 'Date, time, and opponent are required' }, { status: 400 });
  }

  const [result] = await pool.query(
    'INSERT INTO games (game_date, game_time, opponent, location, home_away, notes, season) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [game_date, game_time, opponent, location || null, home_away || 'home', notes || null, season || null]
  );
  const id = (result as { insertId: number }).insertId;
  return NextResponse.json({ id, game_date, game_time, opponent, location, home_away, notes, season }, { status: 201 });
}

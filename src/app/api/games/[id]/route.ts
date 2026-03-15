import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [rows] = await pool.query<never[]>('SELECT * FROM games WHERE id = ?', [id]);
  if (!(rows as never[]).length) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json((rows as never[])[0]);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  const { game_date, game_time, opponent, location, home_away, notes, season } = await req.json();
  if (!game_date || !game_time || !opponent) {
    return NextResponse.json({ error: 'Date, time, and opponent are required' }, { status: 400 });
  }

  await pool.query(
    'UPDATE games SET game_date=?, game_time=?, opponent=?, location=?, home_away=?, notes=?, season=? WHERE id=?',
    [game_date, game_time, opponent, location || null, home_away || 'home', notes || null, season || null, id]
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  await pool.query('DELETE FROM games WHERE id=?', [id]);
  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export async function GET() {
  const [rows] = await pool.query('SELECT * FROM players ORDER BY name ASC');
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { name, email, phone, jersey_number } = await req.json();
  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

  const [result] = await pool.query(
    'INSERT INTO players (name, email, phone, jersey_number) VALUES (?, ?, ?, ?)',
    [name, email || null, phone || null, jersey_number || null]
  );
  const id = (result as { insertId: number }).insertId;
  return NextResponse.json({ id, name, email, phone, jersey_number }, { status: 201 });
}

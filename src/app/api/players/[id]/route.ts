import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  const { name, email, phone, jersey_number } = await req.json();
  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

  await pool.query(
    'UPDATE players SET name=?, email=?, phone=?, jersey_number=? WHERE id=?',
    [name, email || null, phone || null, jersey_number || null, id]
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  await pool.query('DELETE FROM players WHERE id=?', [id]);
  return NextResponse.json({ ok: true });
}

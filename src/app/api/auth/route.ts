import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { pin, type } = await req.json();

  if (type === 'admin' && pin === process.env.ADMIN_PIN) {
    const res = NextResponse.json({ ok: true, role: 'admin' });
    res.cookies.set('auth_role', 'admin', {
      httpOnly: true,
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
      sameSite: 'lax',
    });
    return res;
  }

  if (type === 'player' && pin === process.env.TEAM_PIN) {
    const res = NextResponse.json({ ok: true, role: 'player' });
    res.cookies.set('auth_role', 'player', {
      httpOnly: true,
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
      sameSite: 'lax',
    });
    return res;
  }

  return NextResponse.json({ ok: false, error: 'Invalid PIN' }, { status: 401 });
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set('auth_role', '', { maxAge: 0, path: '/' });
  return res;
}

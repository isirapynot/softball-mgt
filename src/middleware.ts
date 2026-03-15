import { NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  const role = req.cookies.get('auth_role')?.value;
  const { pathname } = req.nextUrl;

  if (
    (pathname.startsWith('/admin/roster') ||
      pathname.startsWith('/admin/schedule') ||
      pathname.startsWith('/admin/lineup') ||
      pathname.startsWith('/admin/stats')) &&
    role !== 'admin'
  ) {
    return NextResponse.redirect(new URL('/admin/login', req.url));
  }

  if (pathname === '/availability' && role !== 'admin' && role !== 'player') {
    return NextResponse.redirect(new URL('/availability/login', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/roster', '/admin/schedule', '/admin/lineup/:path*', '/admin/stats/:path*', '/availability'],
};

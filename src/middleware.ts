import { NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const sessionCookie = req.cookies.get('session')?.value;

  // Simple decoding for role (NOT verified, only for fast route check)
  // Real security is in Cloud Functions and Firestore Rules
  let role = 'guest';
  if (sessionCookie) {
    try {
      const payload = JSON.parse(
        Buffer.from(sessionCookie.split('.')[1], 'base64').toString()
      );
      role = payload.role || 'guest';
    } catch {}
  }

  if (pathname.startsWith('/dashboard') && !['admin', 'superadmin'].includes(role)) {
    return NextResponse.redirect(new URL('/login/admin', req.url));
  }
  if (pathname.startsWith('/superadmin') && role !== 'superadmin') {
    return NextResponse.redirect(new URL('/login/admin', req.url));
  }
  if (pathname.startsWith('/presensi') && role !== 'user') {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/presensi/:path*', '/dashboard/:path*', '/superadmin/:path*'],
};

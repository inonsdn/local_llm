import { NextResponse, type NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isAuthRoute = pathname.startsWith('/login') || pathname.startsWith('/auth');

  // Supabase stores the session in a cookie named sb-<project-ref>-auth-token
  // Check for any cookie that looks like a supabase auth token
  const hasSession = request.cookies.getAll().some(
    (c) => c.name.includes('-auth-token') && c.value,
  );

  if (!hasSession && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (hasSession && pathname === '/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|icons/).*)'],
};

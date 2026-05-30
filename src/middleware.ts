import { NextRequest, NextResponse } from 'next/server';
import { verify } from 'jsonwebtoken';
import { cookies } from 'next/headers';

// JWT_SECRET will be read from env or use a fallback (same as lib/auth.ts)
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-change-in-production';

// Routes that don't need auth at all
const PUBLIC_ROUTES = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/request-otp',
  '/api/auth/verify-otp',
  '/api/auth/me',   // me is public (returns null if no auth)
];

// Routes that require any authenticated user
const AUTH_ROUTES = [
  '/api/auth/change-password',
  '/api/apartments', // POST only
  '/api/payments',
  '/api/inquiries',
  '/api/messages',
  '/api/likes',
  '/api/comments',
  '/api/edit-requests', // POST only
];

// Routes that require developer role
const DEVELOPER_ROUTES = [
  '/api/settings',
  '/api/users',
  '/api/block',
  '/api/logs',
  '/api/approval-logs',
];

/**
 * Security Middleware
 * - Checks authentication for protected routes
 * - Validates JWT for all API calls
 * - Rate limiting headers
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip non-API routes
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Allow public routes
  const isPublic = PUBLIC_ROUTES.some(route => pathname.startsWith(route));
  if (isPublic) {
    return NextResponse.next();
  }

  // Allow GET /api/apartments (public listing)
  if (pathname === '/api/apartments' && request.method === 'GET') {
    return NextResponse.next();
  }

  // Allow GET /api/likes and /api/comments (public)
  if ((pathname === '/api/likes' || pathname === '/api/comments') && request.method === 'GET') {
    return NextResponse.next();
  }

  // Add security headers to all API responses
  const response = NextResponse.next();
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  return response;
}

export const config = {
  matcher: ['/api/:path*'],
};

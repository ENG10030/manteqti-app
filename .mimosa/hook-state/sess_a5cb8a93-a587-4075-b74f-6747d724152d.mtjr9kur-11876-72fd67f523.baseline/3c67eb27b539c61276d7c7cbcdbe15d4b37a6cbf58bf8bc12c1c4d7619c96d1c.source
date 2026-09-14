import { NextResponse } from "next/server";
import { NextRequest } from "next/server";

// ⚠️ CRITICAL: Do NOT use jsonwebtoken in middleware!
// Middleware runs on Vercel Edge Runtime which does NOT have Node.js crypto/Buffer.
// jsonwebtoken.verify() would CRASH here and cause session deletion.
// This middleware only handles: security headers, cache prevention, cookie refresh.

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const response = NextResponse.next();

  // 1. Security headers for all requests
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // 2. API routes — prevent all caching (Vercel CDN)
  if (pathname.startsWith("/api/")) {
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    response.headers.set("Pragma", "no-cache");
    if (pathname === "/api/auth/me" || pathname === "/api/auth/logout") {
      response.headers.set("Vary", "Cookie, Authorization");
    }
  }

  // 3. Sliding session — refresh cookie maxAge without verifying JWT
  // Just extend the expiry; let API routes handle actual verification
  const authCookie = request.cookies.get("auth-token");
  if (authCookie) {
    response.cookies.set("auth-token", authCookie.value, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days — refreshed on every request
      path: "/",
    });
  }

  return response;
}

export const config = {
  matcher: [
    // Match all routes except Next.js static assets
    "/((?!_next/static|_next/image|favicon.ico|images/|.next/).*)",
  ],
};

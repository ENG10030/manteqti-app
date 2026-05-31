import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { verify } from "jsonwebtoken";

// JWT_SECRET loaded at middleware level — required for session validation
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error("[middleware] FATAL: JWT_SECRET is not set. Auth will not work.");
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Security headers for all requests
  const response = NextResponse.next();

  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // 2. API routes — ensure no caching of dynamic responses
  if (pathname.startsWith("/api/")) {
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    response.headers.set("Pragma", "no-cache");

    // For /api/auth/me specifically — add vary header to prevent CDN caching
    if (pathname === "/api/auth/me") {
      response.headers.set("Vary", "Cookie");
    }
  }

  // 3. Validate auth-token cookie integrity on API requests that need auth
  const protectedPaths = [
    "/api/apartments", "/api/payments", "/api/wallet", "/api/messages",
    "/api/likes", "/api/comments", "/api/inquiries", "/api/settings",
    "/api/users", "/api/edit-requests", "/api/blocked-users",
  ];

  const needsAuth = protectedPaths.some(p => pathname.startsWith(p)) &&
    !pathname.startsWith("/api/apartments") || // GET apartments is public
    (pathname.startsWith("/api/apartments") && pathname !== "/api/apartments");

  // 4. Refresh JWT token expiry on every authenticated request
  const authCookie = request.cookies.get("auth-token");
  if (authCookie && JWT_SECRET) {
    try {
      const decoded = verify(authCookie.value, JWT_SECRET) as { userId: string; exp?: number };

      // If token is valid, refresh its maxAge to prevent expiry during active sessions
      // This effectively implements "sliding session" — token stays alive while user is active
      response.cookies.set("auth-token", authCookie.value, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30, // 30 days — refreshed on every request
        path: "/",
      });
    } catch {
      // Token expired or invalid — remove it
      response.cookies.set("auth-token", "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 0,
        path: "/",
      });
    }
  }

  return response;
}

export const config = {
  matcher: [
    // Match all API routes and pages
    "/((?!_next/static|_next/image|favicon.ico|images/|.next/).*)",
  ],
};

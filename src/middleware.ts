import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Rate limiting بسيط (in-memory, limited in serverless)
const rateLimit = new Map<string, { count: number; lastRequest: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000;
const RATE_LIMIT_MAX = 100;

// Stricter rate limits for auth endpoints
const AUTH_RATE_LIMIT_MAX = 15; // per minute for auth endpoints

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Security headers for all routes
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  // HSTS - enforce HTTPS for 1 year, include subdomains
  response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  // Restrict browser features
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  // Prevent MIME type sniffing
  response.headers.set("X-Permitted-Cross-Domain-Policies", "none");

  // Rate limiting for API routes
  if (request.nextUrl.pathname.startsWith("/api")) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
               request.headers.get("x-real-ip") || 
               "unknown";
    
    // Use stricter limits for auth endpoints
    const isAuthEndpoint = request.nextUrl.pathname.startsWith("/api/auth");
    const maxRequests = isAuthEndpoint ? AUTH_RATE_LIMIT_MAX : RATE_LIMIT_MAX;
    const key = `rate-limit-${ip}`;
    const now = Date.now();

    const userLimit = rateLimit.get(key);

    if (userLimit) {
      if (now - userLimit.lastRequest > RATE_LIMIT_WINDOW) {
        rateLimit.set(key, { count: 1, lastRequest: now });
      } else if (userLimit.count >= maxRequests) {
        return NextResponse.json(
          { error: "طلبات كثيرة جداً، يرجى المحاولة لاحقاً" },
          { status: 429 }
        );
      } else {
        rateLimit.set(key, { count: userLimit.count + 1, lastRequest: userLimit.lastRequest });
      }
    } else {
      rateLimit.set(key, { count: 1, lastRequest: now });
    }

    // CORS - restrict to specific domains (NO wildcard)
    const allowedOrigins = process.env.NEXT_PUBLIC_SITE_URL 
      ? [process.env.NEXT_PUBLIC_SITE_URL, 'http://localhost:3000']
      : ['http://localhost:3000'];
    const origin = request.headers.get('origin');
    if (origin && allowedOrigins.includes(origin)) {
      response.headers.set("Access-Control-Allow-Origin", origin);
    }
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    response.headers.set("Access-Control-Allow-Credentials", "true");
  }

  return response;
}

export const config = {
  matcher: [
    "/api/:path*",
    "/((?!_next/static|_next/image|favicon.ico|public).*)",
  ],
};

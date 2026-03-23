import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Rate limiting بسيط
const rateLimit = new Map<string, { count: number; lastRequest: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000;
const RATE_LIMIT_MAX = 100;

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Headers أمنية
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // Rate limiting للـ API
  if (request.nextUrl.pathname.startsWith("/api")) {
    const ip = request.ip || request.headers.get("x-forwarded-for") || "unknown";
    const key = `rate-limit-${ip}`;
    const now = Date.now();

    const userLimit = rateLimit.get(key);

    if (userLimit) {
      if (now - userLimit.lastRequest > RATE_LIMIT_WINDOW) {
        rateLimit.set(key, { count: 1, lastRequest: now });
      } else if (userLimit.count >= RATE_LIMIT_MAX) {
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

    // CORS headers
    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  }

  return response;
}

export const config = {
  matcher: [
    "/api/:path*",
    "/((?!_next/static|_next/image|favicon.ico|public).*)",
  ],
};

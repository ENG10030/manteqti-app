import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Rate limiting بسيط
const rateLimit = new Map<string, { count: number; lastRequest: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000;
const RATE_LIMIT_MAX = 100;

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  const pathname = request.nextUrl.pathname;
  // ⛔ SECURITY: مسار الصور بيرجّع CSP sandbox صارم من الـ route نفسه — ممنوع الـ middleware العام يغطيه
  // (كان الـ CSP العام بيطلع unsafe-inline على محتوى مرفوع = يلغي حماية الـ sandbox)
  const isImageServe = pathname.startsWith('/api/images/');

  // Headers أمنية
  if (!isImageServe) response.headers.set("X-Content-Type-Options", "nosniff");
  if (!isImageServe) response.headers.set("X-Frame-Options", "DENY");
  if (!isImageServe) response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  if (!isImageServe) response.headers.set("Content-Security-Policy",
    "default-src 'self'; " +
    // accounts.google.com مطلوب لزر الدخول بجوجل (سكريبت Google Identity Services + iframe الزر)
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com; " +
    "img-src 'self' data: blob: https://res.cloudinary.com https://images.unsplash.com https://*.googleapis.com https://lh3.googleusercontent.com; " +
    "connect-src 'self' https://api.resend.com https://accounts.google.com; " +
    "frame-src https://accounts.google.com; " +
    "frame-ancestors 'none'; " +
    "base-uri 'self'; " +
    "form-action 'self'"
  );

  // Rate limiting للـ API
  if (request.nextUrl.pathname.startsWith("/api")) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
               request.headers.get("x-real-ip") || 
               "unknown";
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

    // C-10 FIX: Restrict CORS to specific domains
    const allowedOrigins = process.env.NEXT_PUBLIC_SITE_URL 
      ? [process.env.NEXT_PUBLIC_SITE_URL, 'http://localhost:3000']
      : ['http://localhost:3000'];
    const origin = request.headers.get('origin');
    if (origin && allowedOrigins.includes(origin)) {
      response.headers.set("Access-Control-Allow-Origin", origin);
    }
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
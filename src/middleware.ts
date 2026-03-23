import { NextRequest, NextResponse } from 'next/server';

// Rate limiting simple in-memory store
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// تنظيف الذاكرة كل 5 دقائق
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitStore.entries()) {
    if (value.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // إضافة headers أمنية
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Content Security Policy
  const csp = `
    default-src 'self';
    script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live;
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
    font-src 'self' https://fonts.gstatic.com;
    img-src 'self' data: https: blob:;
    media-src 'self' https: blob:;
    connect-src 'self' https:;
    frame-ancestors 'none';
  `.replace(/\s{2,}/g, ' ').trim();
  
  response.headers.set('Content-Security-Policy', csp);

  // Rate limiting للـ API
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const ip = request.headers.get('x-forwarded-for') || 
               request.headers.get('x-real-ip') || 
               'unknown';
    
    const key = `${ip}:${request.nextUrl.pathname}`;
    const now = Date.now();
    const windowMs = 60 * 1000; // دقيقة واحدة
    const maxRequests = 100; // 100 طلب في الدقيقة

    const current = rateLimitStore.get(key);
    
    if (current) {
      if (now > current.resetTime) {
        rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
      } else if (current.count >= maxRequests) {
        return NextResponse.json(
          { error: 'تم تجاوز الحد المسموح من الطلبات. يرجى المحاولة لاحقاً.' },
          { status: 429 }
        );
      } else {
        rateLimitStore.set(key, { count: current.count + 1, resetTime: current.resetTime });
      }
    } else {
      rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
    }
  }

  // حماية من CSRF للطلبات POST/PUT/DELETE
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)) {
    const contentType = request.headers.get('content-type');
    const origin = request.headers.get('origin');
    const host = request.headers.get('host');

    // التحقق من Content-Type
    if (contentType && !contentType.includes('application/json') && !contentType.includes('multipart/form-data')) {
      // السماح ببعض أنواع المحتوى الأخرى
    }

    // التحقق من Origin (حماية CSRF)
    if (origin && host) {
      const originHost = origin.replace(/^https?:\/\//, '');
      if (originHost !== host && !originHost.endsWith('.vercel.app')) {
        return NextResponse.json(
          { error: 'طلب غير مصرح به' },
          { status: 403 }
        );
      }
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};

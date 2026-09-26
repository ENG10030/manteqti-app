import { NextRequest, NextResponse } from 'next/server';
import { sign, verify } from 'jsonwebtoken';
import { JWT_SECRET } from '@/lib/auth';

// ============================================================
// أدوات مشتركة للدخول بالبصمة (WebAuthn / Passkeys) — v9
// ------------------------------------------------------------
// 1) rpID و origin يُشتقان من الطلب نفسه → يعمل تلقائياً على
//    localhost (تجربة) وعلى أي دومين إنتاجي (Vercel) دون إعداد
// 2) الـ challenge يُحفظ في كوكي httpOnly موقّع بـ JWT_SECRET
//    (صالح 5 دقائق) — آمن مع بيئة Serverless (لاذاكرة مشتركة)
// 3) لا نحفظ أبداً أي بيانات حيوية — مفاتيح عامة فقط
// ============================================================

export const RP_NAME = 'منطقتي | Manteqti';

const CHALLENGE_COOKIE = 'webauthn-challenge';
const CHALLENGE_TTL_SECONDS = 5 * 60;

type ChallengeType = 'register' | 'login';

interface ChallengePayload {
  challenge: string;
  type: ChallengeType;
  userId?: string;
}

// استخراج rpID و origin من طلب المستخدم نفسه
export function getRPInfo(request: NextRequest): { rpID: string; origin: string } {
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || 'localhost:3000';
  const forwardedProto = request.headers.get('x-forwarded-proto');
  const isLocal = host.startsWith('localhost') || host.startsWith('127.0.0.1') || host.startsWith('[::1]');
  const proto = forwardedProto ? forwardedProto.split(',')[0].trim() : (isLocal ? 'http' : 'https');
  const hostname = host.split(':')[0];
  return { rpID: hostname, origin: `${proto}://${host}` };
}

// حفظ التحدي في كوكي موقّع (يُستبدل بالقيمة على كل طلب جديد)
export function setChallengeCookie(
  response: NextResponse,
  data: { challenge: string; type: ChallengeType; userId?: string }
): void {
  const token = sign(data, JWT_SECRET!, { expiresIn: `${CHALLENGE_TTL_SECONDS}s` });
  response.cookies.set(CHALLENGE_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax', // lax وليس strict — نافذة البصمة قد تفتح في سياق أعلى
    maxAge: CHALLENGE_TTL_SECONDS,
    path: '/',
  });
}

// قراءة والتحقق من التحدي — يفشل مغلقاً لو مفيش كوكي أو النوع مختلف
export function readChallengeCookie(
  request: NextRequest,
  expectedType: ChallengeType
): ChallengePayload | null {
  try {
    const token = request.cookies.get(CHALLENGE_COOKIE)?.value;
    if (!token) return null;
    const decoded = verify(token, JWT_SECRET!) as unknown as ChallengePayload;
    if (!decoded || !decoded.challenge || decoded.type !== expectedType) return null;
    return decoded;
  } catch {
    return null;
  }
}

// مسح كوكي التحدي بعد الاستخدام
export function clearChallengeCookie(response: NextResponse): void {
  response.cookies.set(CHALLENGE_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });
}

// تحويل المفتاح العام من/إلى base64url للتخزين في قاعدة البيانات
export function keyToBase64URL(key: Uint8Array): string {
  return Buffer.from(key).toString('base64url');
}

export function keyFromBase64URL(value: string): Uint8Array<ArrayBuffer> {
  const buf = Buffer.from(value, 'base64url');
  const out = new Uint8Array(new ArrayBuffer(buf.length));
  out.set(buf);
  return out;
}

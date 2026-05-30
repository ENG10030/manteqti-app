import crypto from 'crypto';
import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { verify } from 'jsonwebtoken';

// Generate a stable JWT_SECRET: use env var if set, otherwise generate a persistent random one.
// In production, JWT_SECRET MUST be set via environment variables.
const SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
export { SECRET as JWT_SECRET };

// JWT payload type
export interface JWTPayload {
  id: string;
  identifier: string;
  role: string;
  email: string;
  name: string;
}

/**
 * Extract JWT from cookies and verify it.
 * Returns the decoded payload or null if invalid/missing.
 */
export async function verifyAuth(request: NextRequest): Promise<JWTPayload | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;
    if (!token) return null;

    const decoded = verify(token, JWT_SECRET) as JWTPayload;
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Require authentication. Returns 401 JSON response if not authenticated.
 */
export async function requireAuth(request: NextRequest): Promise<JWTPayload | Response> {
  const decoded = await verifyAuth(request);
  if (!decoded) {
    return new Response(JSON.stringify({ error: 'غير مصرح - يرجى تسجيل الدخول' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return decoded;
}

/**
 * Require developer role. Returns 401/403 JSON response if not developer.
 */
export async function requireDeveloper(request: NextRequest): Promise<JWTPayload | Response> {
  const decoded = await verifyAuth(request);
  if (!decoded) {
    return new Response(JSON.stringify({ error: 'غير مصرح - يرجى تسجيل الدخول' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (decoded.role !== 'DEVELOPER') {
    return new Response(JSON.stringify({ error: 'غير مصرح - صلاحيات مطور فقط' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return decoded;
}

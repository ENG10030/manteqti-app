// Comprehensive authentication and authorization middleware
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';
import { verify } from 'jsonwebtoken';
import { JWT_SECRET } from '@/lib/auth';

export interface AuthContext {
  userId: string;
  role: string;
  isApproved: boolean;
  isBlocked: boolean;
  identifier: string;
}

/**
 * Validates if a string is a valid CUID (Prisma's default ID format)
 */
export function isValidId(id: string): boolean {
  const cuidRegex = /^c[a-z0-9]{24}$/;
  const cuid2Regex = /^[a-z0-9]{24,32}$/;
  return cuidRegex.test(id) || cuid2Regex.test(id);
}

/**
 * Validates Egyptian phone number format
 */
export function isValidEgyptianPhone(phone: string): boolean {
  const egyptianMobileRegex = /^01[0125][0-9]{8}$/;
  return egyptianMobileRegex.test(phone);
}

/**
 * Sanitizes string input to prevent XSS
 */
export function sanitizeString(str: string): string {
  return str
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Get authenticated user context with full validation
 * Returns { auth, errorResponse } - if errorResponse is set, return it immediately
 */
export async function getAuthContext(request: NextRequest): Promise<{ auth: AuthContext | null; errorResponse: NextResponse | null }> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;

    if (!token) {
      return { auth: null, errorResponse: NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 }) };
    }

    let decoded: { userId: string; role?: string; identifier?: string };
    try {
      decoded = verify(token, JWT_SECRET) as typeof decoded;
      if (!decoded.userId) {
        return { auth: null, errorResponse: NextResponse.json({ error: 'رمز المصادقة غير صالح' }, { status: 401 }) };
      }
    } catch {
      return { auth: null, errorResponse: NextResponse.json({ error: 'انتهت صلاحية الجلسة. يرجى تسجيل الدخول مرة أخرى' }, { status: 401 }) };
    }

    // Get fresh user data from DB to check current status
    const user = await db.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        role: true,
        isApproved: true,
        isBlocked: true,
        identifier: true,
      },
    });

    if (!user) {
      return { auth: null, errorResponse: NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 401 }) };
    }

    // Check if user is blocked
    if (user.isBlocked) {
      return { auth: null, errorResponse: NextResponse.json({ error: 'تم حظر حسابك. تواصل مع الإدارة', isBlocked: true }, { status: 403 }) };
    }

    return {
      auth: {
        userId: user.id,
        role: user.role,
        isApproved: user.isApproved,
        isBlocked: user.isBlocked,
        identifier: user.identifier,
      },
      errorResponse: null,
    };
  } catch (error) {
    console.error('Auth context error:', error);
    return { auth: null, errorResponse: NextResponse.json({ error: 'خطأ في المصادقة' }, { status: 500 }) };
  }
}

/**
 * Require user to be authenticated AND approved (for user actions)
 * Use this for: creating apartments, comments, likes, messages, inquiries, etc.
 */
export async function requireApprovedUser(request: NextRequest): Promise<{ auth: AuthContext; errorResponse: null } | { auth: null; errorResponse: NextResponse }> {
  const { auth, errorResponse } = await getAuthContext(request);
  if (errorResponse || !auth) {
    return { auth: null, errorResponse: errorResponse as NextResponse };
  }

  // Developers always pass (they bypass approval)
  if (auth.role === 'DEVELOPER') {
    return { auth, errorResponse: null };
  }

  // Regular users must be approved
  if (!auth.isApproved) {
    return {
      auth: null,
      errorResponse: NextResponse.json({ error: 'حسابك قيد المراجعة. بانتظار موافقة الإدارة', pendingApproval: true }, { status: 403 }),
    };
  }

  return { auth, errorResponse: null };
}

/**
 * Require developer authentication (for developer-only actions)
 * Use this for: settings, approvals, deletions, logs, etc.
 */
export async function requireDeveloper(request: NextRequest): Promise<{ auth: AuthContext; errorResponse: null } | { auth: null; errorResponse: NextResponse }> {
  const { auth, errorResponse } = await getAuthContext(request);
  if (errorResponse || !auth) {
    return { auth: null, errorResponse: errorResponse as NextResponse };
  }

  if (auth.role !== 'DEVELOPER') {
    return {
      auth: null,
      errorResponse: NextResponse.json({ error: 'غير مصرح - هذا الإجراء مخصص للمطور فقط' }, { status: 403 }),
    };
  }

  return { auth, errorResponse: null };
}

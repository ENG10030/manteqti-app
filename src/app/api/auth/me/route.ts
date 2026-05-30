import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth } from '@/lib/auth';

/**
 * GET /api/auth/me
 * Returns current user info. Checks if user still exists in DB.
 * - If user deleted: { userDeleted: true }
 * - If user blocked: { userBlocked: true }
 * - Otherwise: { user: { id, email, name, identifier, role, isApproved, emailVerified, isBlocked, phone } }
 */
export async function GET(request: NextRequest) {
  try {
    const decoded = await verifyAuth(request);
    if (!decoded) {
      return NextResponse.json({ user: null });
    }

    // Check if user still exists in DB (handles deleted users)
    const user = await db.user.findUnique({
      where: { id: decoded.id },
    });

    if (!user) {
      // User was deleted from DB but token still valid
      return NextResponse.json({ userDeleted: true });
    }

    // Check if user is blocked
    if (user.isBlocked) {
      return NextResponse.json({ userBlocked: true, user: {
        id: user.id,
        email: user.email,
        name: user.name,
        identifier: user.identifier,
        role: user.role,
        isApproved: user.isApproved,
        emailVerified: user.emailVerified,
        isBlocked: user.isBlocked,
        phone: user.phone,
      }});
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        identifier: user.identifier,
        role: user.role,
        isApproved: user.isApproved,
        emailVerified: user.emailVerified,
        isBlocked: user.isBlocked,
        phone: user.phone,
      },
    });
  } catch (error) {
    console.error('Error in /api/auth/me:', error);
    return NextResponse.json({ user: null }, { status: 500 });
  }
}

/**
 * POST /api/auth/me
 * Handle logout by clearing the auth-token cookie.
 */
export async function POST(request: NextRequest) {
  const response = NextResponse.json({ success: true, message: 'تم تسجيل الخروج بنجاح' });

  // Clear the auth-token cookie
  response.cookies.set('auth-token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
    expires: new Date(0),
  });

  return response;
}

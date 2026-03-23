import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    // Get session token from cookie
    const token = request.cookies.get('session_token')?.value;

    if (!token) {
      return NextResponse.json({
        user: null
      });
    }

    // Find session
    const session = await db.session.findUnique({
      where: { token },
      include: { user: true }
    });

    if (!session) {
      const response = NextResponse.json({ user: null });
      response.cookies.delete('session_token');
      return response;
    }

    // Check if session expired
    if (session.expiresAt < new Date()) {
      // Delete expired session
      await db.session.delete({ where: { token } });
      const response = NextResponse.json({ user: null });
      response.cookies.delete('session_token');
      return response;
    }

    // Check if user is blocked
    if (session.user.isBlocked) {
      await db.session.delete({ where: { token } });
      const response = NextResponse.json({ user: null, blocked: true });
      response.cookies.delete('session_token');
      return response;
    }

    return NextResponse.json({
      user: {
        id: session.user.id,
        identifier: session.user.identifier,
        name: session.user.name,
        phone: session.user.phone,
        email: session.user.email
      }
    });
  } catch (error) {
    console.error('Get current user error:', error);
    return NextResponse.json({
      user: null
    });
  }
}

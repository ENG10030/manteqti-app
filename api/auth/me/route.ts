import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    // Check for cookie first (most secure), then Authorization header, then query param
    const cookieToken = request.cookies.get('auth_token')?.value;
    const authHeader = request.headers.get('authorization');
    const headerToken = authHeader?.replace('Bearer ', '');
    const queryToken = request.nextUrl.searchParams.get('token');
    
    const token = cookieToken || headerToken || queryToken;

    if (!token) {
      return NextResponse.json({ user: null });
    }

    // Find session
    const session = await db.session.findUnique({
      where: { token }
    });

    if (!session || session.expiresAt < new Date()) {
      // Clear invalid cookie
      const response = NextResponse.json({ user: null });
      response.cookies.delete('auth_token');
      return response;
    }

    // Find user
    const user = await db.user.findUnique({
      where: { id: session.userId }
    });

    if (!user) {
      return NextResponse.json({ user: null });
    }

    return NextResponse.json({ 
      user: {
        id: user.id,
        identifier: user.identifier,
        name: user.name,
      }
    });
  } catch {
    return NextResponse.json({ user: null });
  }
}

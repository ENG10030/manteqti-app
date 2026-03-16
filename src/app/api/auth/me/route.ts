import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    // Check for Authorization header or query param
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '') || 
                  request.nextUrl.searchParams.get('token');

    if (!token) {
      return NextResponse.json({ user: null });
    }

    // Find session
    const session = await db.session.findUnique({
      where: { token },
      include: { user: true }
    });

    if (!session || session.expiresAt < new Date()) {
      return NextResponse.json({ user: null });
    }

    return NextResponse.json({ 
      user: {
        id: session.user.id,
        identifier: session.user.identifier,
        name: session.user.name,
      }
    });
  } catch {
    return NextResponse.json({ user: null });
  }
}

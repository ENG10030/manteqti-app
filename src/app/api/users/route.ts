import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireDeveloper } from '@/lib/auth';

/**
 * GET /api/users
 * Require developer auth. Return all users.
 * If ?pending=true, return only unapproved users.
 */
export async function GET(request: NextRequest) {
  try {
    const decoded = await requireDeveloper(request);
    if (decoded instanceof Response) return decoded;

    const { searchParams } = new URL(request.url);
    const pendingOnly = searchParams.get('pending') === 'true';

    const where: Record<string, unknown> = pendingOnly
      ? { isApproved: false }
      : {};

    const users = await db.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        identifier: true,
        phone: true,
        role: true,
        isApproved: true,
        emailVerified: true,
        isBlocked: true,
        blockReason: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

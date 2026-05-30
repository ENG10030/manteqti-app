import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireDeveloper } from '@/lib/auth';

/**
 * POST /api/block
 * Require developer auth. Block a user.
 * Body: { userId: string, reason?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const decoded = await requireDeveloper(request);
    if (decoded instanceof Response) return decoded;

    const body = await request.json();
    const { userId, reason } = body;

    if (!userId) {
      return NextResponse.json({ error: 'معرف المستخدم مطلوب' }, { status: 400 });
    }

    // Verify user exists
    const user = await db.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 });
    }

    if (user.role === 'DEVELOPER') {
      return NextResponse.json({ error: 'لا يمكن حظر حساب المطور' }, { status: 403 });
    }

    // Block the user
    await db.user.update({
      where: { id: userId },
      data: { isBlocked: true, blockReason: reason || 'محظور من قبل الإدارة' },
    });

    // Create block record
    await db.block.create({
      data: {
        userId,
        blockedUserId: userId,
        reason: reason || 'محظور من قبل الإدارة',
      },
    });

    // Log block action
    try {
      await db.operationLog.create({
        data: {
          action: 'USER_BLOCKED',
          entityType: 'User',
          entityId: userId,
          details: JSON.stringify({ blockedUser: user.name, email: user.email, reason, blockedBy: decoded.identifier }),
          userId: decoded.id,
        },
      });
    } catch {}

    return NextResponse.json({ success: true, message: `تم حظر المستخدم "${user.name}" ✅` });
  } catch (error) {
    console.error('Error blocking user:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

/**
 * DELETE /api/block
 * Require developer auth. Unblock a user.
 * Body: { userId: string }
 */
export async function DELETE(request: NextRequest) {
  try {
    const decoded = await requireDeveloper(request);
    if (decoded instanceof Response) return decoded;

    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json({ error: 'معرف المستخدم مطلوب' }, { status: 400 });
    }

    // Verify user exists
    const user = await db.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 });
    }

    // Unblock the user
    await db.user.update({
      where: { id: userId },
      data: { isBlocked: false, blockReason: null },
    });

    // Remove block records
    await db.block.deleteMany({ where: { userId } });

    // Log unblock action
    try {
      await db.operationLog.create({
        data: {
          action: 'USER_UNBLOCKED',
          entityType: 'User',
          entityId: userId,
          details: JSON.stringify({ unblockedUser: user.name, email: user.email, unblockedBy: decoded.identifier }),
          userId: decoded.id,
        },
      });
    } catch {}

    return NextResponse.json({ success: true, message: `تم إلغاء حظر المستخدم "${user.name}" ✅` });
  } catch (error) {
    console.error('Error unblocking user:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

/**
 * GET /api/block
 * Require developer auth. Return blocked users.
 */
export async function GET(request: NextRequest) {
  try {
    const decoded = await requireDeveloper(request);
    if (decoded instanceof Response) return decoded;

    const blockedUsers = await db.user.findMany({
      where: { isBlocked: true },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        identifier: true,
        isBlocked: true,
        blockReason: true,
        createdAt: true,
      },
    });

    // Also get Block records with user details
    const blocks = await db.block.findMany({
      orderBy: { blockedAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, identifier: true } },
      },
    });

    return NextResponse.json({ blockedUsers, blocks });
  } catch (error) {
    console.error('Error fetching blocked users:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

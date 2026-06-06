import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireApprovedUser } from '@/lib/auth-middleware';

// جلب سجل إجراءات التعليقات (developer only)
export async function GET(request: NextRequest) {
  try {
    const { auth, errorResponse } = await requireApprovedUser(request);
    if (errorResponse) return errorResponse;
    if (auth.role !== 'DEVELOPER') return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const commentId = searchParams.get('commentId');
    const action = searchParams.get('action');
    const limit = parseInt(searchParams.get('limit') || '100');

    const where: Record<string, unknown> = {};
    if (commentId) where.commentId = commentId;
    if (action) where.action = action;

    const logs = await db.commentActionLog.findMany({
      where,
      include: {
        comment: {
          include: {
            user: { select: { id: true, name: true } },
            apartment: { select: { id: true, title: true } },
          }
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return NextResponse.json(logs);
  } catch (error) {
    console.error('Error fetching comment logs:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

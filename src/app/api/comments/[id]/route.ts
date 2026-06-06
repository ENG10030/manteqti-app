import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireApprovedUser } from '@/lib/auth-middleware';

// الموافقة على التعليق أو رفضه (developer only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { auth, errorResponse } = await requireApprovedUser(request);
    if (errorResponse) return errorResponse;
    if (auth.role !== 'DEVELOPER') return NextResponse.json({ error: 'غير مصرح - فقط المطور' }, { status: 403 });

    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    if (!status || !['approved', 'rejected', 'deleted'].includes(status)) {
      return NextResponse.json({ error: 'حالة غير صالحة' }, { status: 400 });
    }

    const comment = await db.comment.update({
      where: { id },
      data: { status },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            identifier: true,
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      comment,
      message: status === 'approved' ? 'تمت الموافقة على التعليق' : status === 'rejected' ? 'تم رفض التعليق' : 'تم حذف التعليق'
    });
  } catch (error) {
    console.error('Error updating comment:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

// حذف التعليق - المطور يحذف أي تعليق، صاحب التعليق يحذف تعليقه فقط
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { auth, errorResponse } = await requireApprovedUser(request);
    if (errorResponse) return errorResponse;

    const { id } = await params;

    // Check if comment exists
    const existing = await db.comment.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'التعليق غير موجود' }, { status: 404 });

    // Developer can delete any comment (permanent delete)
    // Comment owner can only soft-delete their own comment
    const isDeveloper = auth.role === 'DEVELOPER';
    const isOwner = existing.userId === auth.userId;

    if (isDeveloper) {
      // Developer: permanent delete from database
      await db.comment.delete({ where: { id } });
      return NextResponse.json({ success: true, message: 'تم حذف التعليق نهائياً', permanent: true });
    } else if (isOwner) {
      // Owner: soft delete (mark as deleted)
      await db.comment.update({
        where: { id },
        data: { status: 'deleted' },
      });
      return NextResponse.json({ success: true, message: 'تم حذف تعليقك', permanent: false });
    } else {
      return NextResponse.json({ error: 'غير مصرح - ليس تعليقك' }, { status: 403 });
    }
  } catch (error) {
    console.error('Error deleting comment:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

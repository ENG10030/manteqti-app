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

    if (!status || !['approved', 'rejected', 'deleted', 'pending'].includes(status)) {
      return NextResponse.json({ error: 'حالة غير صالحة' }, { status: 400 });
    }

    // Check if comment exists
    const existing = await db.comment.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'التعليق غير موجود' }, { status: 404 });

    const previousStatus = existing.status;

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

    // Log the action
    const actionMessages: Record<string, string> = {
      approved: `تمت الموافقة على التعليق (كان: ${previousStatus})`,
      rejected: `تم رفض التعليق (كان: ${previousStatus})`,
      deleted: `تم حذف التعليق نهائياً بواسطة المطور (كان: ${previousStatus})`,
      pending: `تم إرجاع التعليق للمراجعة (كان: ${previousStatus})`,
    };

    await db.commentActionLog.create({
      data: {
        commentId: id,
        action: status === 'approved' ? 'approved' : status === 'rejected' ? 'rejected' : status === 'deleted' ? 'deleted_by_developer' : 'returned_to_pending',
        performedBy: auth.userId,
        details: actionMessages[status] || `تم تغيير الحالة إلى ${status}`,
      }
    });

    return NextResponse.json({
      success: true,
      comment,
      message: status === 'approved' ? 'تمت الموافقة على التعليق' : status === 'rejected' ? 'تم رفض التعليق' : status === 'deleted' ? 'تم حذف التعليق نهائياً' : 'تم إرجاع التعليق للمراجعة'
    });
  } catch (error) {
    console.error('Error updating comment:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

// حذف التعليق - المطور يحذف أي تعليق نهائياً، صاحب التعليق يحذف تعليقه فقط (soft delete)
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

    // Developer can delete any comment (permanent delete from DB)
    // Comment owner can only soft-delete their own comment (mark as deleted)
    const isDeveloper = auth.role === 'DEVELOPER';
    const isOwner = existing.userId === auth.userId;

    if (isDeveloper) {
      // Developer: permanent delete from database
      await db.commentActionLog.create({
        data: {
          commentId: id,
          action: 'deleted_permanent_by_developer',
          performedBy: auth.userId,
          details: `المطور حذف التعليق نهائياً من قاعدة البيانات - المحتوى: "${existing.content.substring(0, 50)}..."`,
        }
      });
      await db.comment.delete({ where: { id } });
      return NextResponse.json({ success: true, message: 'تم حذف التعليق نهائياً من قاعدة البيانات', permanent: true });
    } else if (isOwner) {
      // Owner: soft delete (mark as deleted)
      await db.comment.update({
        where: { id },
        data: { status: 'deleted' },
      });
      await db.commentActionLog.create({
        data: {
          commentId: id,
          action: 'deleted_by_owner',
          performedBy: auth.userId,
          details: 'صاحب التعليق حذف تعليقه',
        }
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

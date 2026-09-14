import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireApprovedUser } from '@/lib/auth-middleware';

// تسجيل إجراء بشكل اختياري - لا يوقف العملية لو فشل
async function logAction(data: { commentId: string; action: string; performedBy: string; details: string }) {
  try {
    await db.commentActionLog.create({ data });
  } catch (error) {
    console.error('Failed to log comment action (non-blocking):', error);
  }
}

// الموافقة على التعليق أو رفضه أو حذفه (developer only) - soft actions
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

    // Log the action (non-blocking)
    const actionMessages: Record<string, string> = {
      approved: `تمت الموافقة على التعليق (كان: ${previousStatus})`,
      rejected: `تم رفض التعليق (كان: ${previousStatus})`,
      deleted: `تم حذف التعليق بواسطة المطور (كان: ${previousStatus})`,
      pending: `تم إرجاع التعليق للمراجعة (كان: ${previousStatus})`,
    };

    logAction({
      commentId: id,
      action: status === 'approved' ? 'approved' : status === 'rejected' ? 'rejected' : status === 'deleted' ? 'deleted_by_developer' : 'returned_to_pending',
      performedBy: auth.userId,
      details: actionMessages[status] || `تم تغيير الحالة إلى ${status}`,
    });

    return NextResponse.json({
      success: true,
      comment,
      message: status === 'approved' ? 'تمت الموافقة على التعليق' : status === 'rejected' ? 'تم رفض التعليق' : status === 'deleted' ? 'تم حذف التعليق' : 'تم إرجاع التعليق للمراجعة'
    });
  } catch (error) {
    console.error('Error updating comment:', error);
    return NextResponse.json({ error: 'حدث خطأ في تحديث التعليق' }, { status: 500 });
  }
}

// حذف التعليق نهائياً من الداتابيز (permanent delete) - developer only
// المستخدم العادي يعمل soft delete عن طريق PUT { status: 'deleted' }
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

    const isDeveloper = auth.role === 'DEVELOPER';
    const isOwner = existing.userId === auth.userId;

    if (isDeveloper) {
      // Developer: permanent delete from database
      await logAction({
        commentId: id,
        action: 'deleted_permanent_by_developer',
        performedBy: auth.userId,
        details: `المطور حذف التعليق نهائياً من قاعدة البيانات - المحتوى: "${existing.content.substring(0, 50)}..."`,
      });
      await db.comment.delete({ where: { id } });
      return NextResponse.json({ success: true, message: 'تم حذف التعليق نهائياً من قاعدة البيانات', permanent: true });
    } else if (isOwner) {
      // Owner: soft delete (mark as deleted) via update
      await db.comment.update({
        where: { id },
        data: { status: 'deleted' },
      });
      await logAction({
        commentId: id,
        action: 'deleted_by_owner',
        performedBy: auth.userId,
        details: 'صاحب التعليق حذف تعليقه',
      });
      return NextResponse.json({ success: true, message: 'تم حذف تعليقك', permanent: false });
    } else {
      return NextResponse.json({ error: 'غير مصرح - ليس تعليقك' }, { status: 403 });
    }
  } catch (error) {
    console.error('Error deleting comment:', error);
    return NextResponse.json({ error: 'حدث خطأ في حذف التعليق' }, { status: 500 });
  }
}

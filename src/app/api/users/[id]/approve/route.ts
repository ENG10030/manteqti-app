import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireDeveloper } from '@/lib/auth';

/**
 * PUT /api/users/[id]/approve
 * Require developer auth. Approve, reject, or revoke user approval.
 * Body: { action: 'approve' | 'reject' | 'revoke', reason?: string }
 * Logs approval actions in ApprovalLog.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const decoded = await requireDeveloper(request);
    if (decoded instanceof Response) return decoded;

    const { id } = await params;
    const body = await request.json();
    const { action, reason } = body;

    if (!action || !['approve', 'reject', 'revoke'].includes(action)) {
      return NextResponse.json({ error: 'إجراء غير صالح. يجب أن يكون approve, reject, أو revoke' }, { status: 400 });
    }

    // Verify user exists
    const user = await db.user.findUnique({
      where: { id },
    });

    if (!user) {
      return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 });
    }

    // Prevent approving/rejecting developer
    if (user.role === 'DEVELOPER') {
      return NextResponse.json({ error: 'لا يمكن تعديل حالة حساب المطور' }, { status: 403 });
    }

    let updatedUser;

    if (action === 'approve') {
      // Approve user
      updatedUser = await db.user.update({
        where: { id },
        data: { isApproved: true },
      });

      // Log approval
      try {
        await db.approvalLog.create({
          data: {
            id,
            action: 'approved',
            userName: user.name,
            userEmail: user.email,
            reason: reason || null,
            performedBy: decoded.identifier,
          },
        });
        await db.operationLog.create({
          data: {
            action: 'USER_APPROVED',
            entityType: 'User',
            entityId: id,
            details: JSON.stringify({ userName: user.name, email: user.email, approvedBy: decoded.identifier }),
            id: decoded.id,
          },
        });
      } catch {}

      return NextResponse.json({ success: true, message: `تم تأكيد حساب "${user.name}" بنجاح ✅`, user: updatedUser });

    } else if (action === 'reject') {
      // Reject user and delete their account
      // Delete related data first (same as delete route but via cascade)
      await db.like.deleteMany({ where: { id } });
      await db.comment.deleteMany({ where: { id } });
      await db.message.deleteMany({ where: { OR: [{ senderId: id }, { receiverId: id }] } });
      await db.block.deleteMany({ where: { OR: [{ id }, { blockedUserId: id }] } });

      const userInquiries = await db.inquiry.findMany({ where: { id }, select: { id: true } });
      const inquiryIds = userInquiries.map(i => i.id);
      if (inquiryIds.length > 0) {
        await db.payment.deleteMany({ where: { inquiryId: { in: inquiryIds } } });
      }
      await db.inquiry.deleteMany({ where: { id } });
      await db.editRequest.deleteMany({ where: { id } });

      const userApartments = await db.apartment.findMany({ where: { createdBy: id }, select: { id: true } });
      const apartmentIds = userApartments.map(a => a.id);
      if (apartmentIds.length > 0) {
        const aptInquiries = await db.inquiry.findMany({ where: { apartmentId: { in: apartmentIds } }, select: { id: true } });
        const aptInquiryIds = aptInquiries.map(i => i.id);
        if (aptInquiryIds.length > 0) {
          await db.payment.deleteMany({ where: { inquiryId: { in: aptInquiryIds } } });
        }
        await db.inquiry.deleteMany({ where: { apartmentId: { in: apartmentIds } } });
        await db.like.deleteMany({ where: { apartmentId: { in: apartmentIds } } });
        await db.comment.deleteMany({ where: { apartmentId: { in: apartmentIds } } });
        await db.apartment.deleteMany({ where: { id: { in: apartmentIds } } });
      }

      await db.approvalLog.deleteMany({ where: { id } });
      await db.operationLog.deleteMany({ where: { id } });
      await db.user.delete({ where: { id: id } });

      // Log rejection
      try {
        await db.approvalLog.create({
          data: {
            id,
            action: 'rejected',
            userName: user.name,
            userEmail: user.email,
            reason: reason || 'مرفوض من قبل الإدارة',
            performedBy: decoded.identifier,
          },
        });
        await db.operationLog.create({
          data: {
            action: 'USER_REJECTED_DELETED',
            entityType: 'User',
            entityId: id,
            details: JSON.stringify({ userName: user.name, email: user.email, rejectedBy: decoded.identifier, reason }),
            id: decoded.id,
          },
        });
      } catch {}

      return NextResponse.json({ success: true, message: `تم رفض وحذف حساب "${user.name}" بنجاح` });

    } else if (action === 'revoke') {
      // Revoke user approval
      updatedUser = await db.user.update({
        where: { id: id },
        data: { isApproved: false },
      });

      // Log revocation
      try {
        await db.approvalLog.create({
          data: {
            id,
            action: 'revoked',
            userName: user.name,
            userEmail: user.email,
            reason: reason || null,
            performedBy: decoded.identifier,
          },
        });
        await db.operationLog.create({
          data: {
            action: 'USER_APPROVAL_REVOKED',
            entityType: 'User',
            entityId: id,
            details: JSON.stringify({ userName: user.name, email: user.email, revokedBy: decoded.identifier, reason }),
            id: decoded.id,
          },
        });
      } catch {}

      return NextResponse.json({ success: true, message: `تم إلغاء تأكيد حساب "${user.name}" ✅`, user: updatedUser });
    }

    return NextResponse.json({ error: 'إجراء غير معروف' }, { status: 400 });
  } catch (error) {
    console.error('Error in approve/reject user:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

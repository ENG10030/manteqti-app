import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireDeveloper } from '@/lib/auth';

/**
 * DELETE /api/users/[userId]/delete
 * Require developer auth. Delete user and ALL related data.
 * Related data: apartments, inquiries, payments, messages, likes, comments, blocks.
 * Add to operation log.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const decoded = await requireDeveloper(request);
    if (decoded instanceof Response) return decoded;

    const { userId } = await params;

    // Verify user exists
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, identifier: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 });
    }

    // Prevent deleting the developer account
    if (user.role === 'DEVELOPER') {
      return NextResponse.json({ error: 'لا يمكن حذف حساب المطور' }, { status: 403 });
    }

    // Delete all related data in correct order (respect FK constraints)

    // 1. Delete likes
    await db.like.deleteMany({ where: { userId } });

    // 2. Delete comments
    await db.comment.deleteMany({ where: { userId } });

    // 3. Delete messages (as sender or receiver)
    await db.message.deleteMany({ where: { OR: [{ senderId: userId }, { receiverId: userId }] } });

    // 4. Delete blocks
    await db.block.deleteMany({ where: { OR: [{ userId }, { blockedUserId: userId }] } });

    // 5. Delete payments (through inquiries)
    // First find inquiries by this user
    const userInquiries = await db.inquiry.findMany({
      where: { userId },
      select: { id: true },
    });
    const inquiryIds = userInquiries.map(i => i.id);
    if (inquiryIds.length > 0) {
      await db.payment.deleteMany({ where: { inquiryId: { in: inquiryIds } } });
    }

    // 6. Delete inquiries
    await db.inquiry.deleteMany({ where: { userId } });

    // 7. Delete edit requests
    await db.editRequest.deleteMany({ where: { userId } });

    // 8. Delete apartments created by this user
    // First delete inquiries/payments linked to these apartments
    const userApartments = await db.apartment.findMany({
      where: { createdBy: userId },
      select: { id: true },
    });
    const apartmentIds = userApartments.map(a => a.id);
    if (apartmentIds.length > 0) {
      const aptInquiries = await db.inquiry.findMany({
        where: { apartmentId: { in: apartmentIds } },
        select: { id: true },
      });
      const aptInquiryIds = aptInquiries.map(i => i.id);
      if (aptInquiryIds.length > 0) {
        await db.payment.deleteMany({ where: { inquiryId: { in: aptInquiryIds } } });
      }
      await db.inquiry.deleteMany({ where: { apartmentId: { in: apartmentIds } } });
      await db.like.deleteMany({ where: { apartmentId: { in: apartmentIds } } });
      await db.comment.deleteMany({ where: { apartmentId: { in: apartmentIds } } });
      await db.apartment.deleteMany({ where: { id: { in: apartmentIds } } });
    }

    // 9. Delete approval logs for this user
    await db.approvalLog.deleteMany({ where: { userId } });

    // 10. Delete operation logs for this user
    await db.operationLog.deleteMany({ where: { userId } });

    // 11. Finally, delete the user
    await db.user.delete({ where: { id: userId } });

    // Log the deletion
    try {
      await db.operationLog.create({
        data: {
          action: 'USER_DELETED',
          entityType: 'User',
          entityId: userId,
          details: JSON.stringify({
            deletedUser: { id: user.id, name: user.name, email: user.email },
            deletedBy: decoded.identifier,
            apartmentsDeleted: apartmentIds.length,
            inquiriesDeleted: userInquiries.length,
          }),
          userId: decoded.id,
        },
      });
    } catch {}

    return NextResponse.json({
      success: true,
      message: `تم حذف المستخدم "${user.name}" وجميع بياناته بنجاح ✅`,
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء حذف المستخدم' }, { status: 500 });
  }
}

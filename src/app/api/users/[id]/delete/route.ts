import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { notifyRealtime } from "@/lib/realtime";

// حذف مستخدم مع خيار تحديد البيانات المراد حذفها (المطور فقط)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser(request);

    if (!currentUser || currentUser.role !== "DEVELOPER") {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const { id: userId } = await params;

    // Parse delete options from request body
    let deleteOptions = {
      apartments: true,
      payments: true,
      inquiries: true,
      likes: true,
      comments: true,
      messages: true,
      editRequests: true,
      blockedUsers: true,
    };

    try {
      const body = await request.json();
      if (body.deleteOptions && typeof body.deleteOptions === 'object') {
        deleteOptions = { ...deleteOptions, ...body.deleteOptions };
      }
    } catch {
      // No body = default (delete everything)
    }

    const targetUser = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, role: true, identifier: true },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "المستخدم غير موجود" }, { status: 404 });
    }

    if (targetUser.role === "DEVELOPER") {
      return NextResponse.json({ error: "لا يمكن حذف حساب المطور" }, { status: 400 });
    }

    // Get user's data counts for logging
    const userStats: Record<string, number> = {};
    try { userStats.apartments = await db.apartment.count({ where: { createdBy: userId } }); } catch {}
    try { userStats.inquiries = await db.inquiry.count({ where: { userId } }); } catch {}
    try { userStats.payments = await db.payment.count({ where: { userId } }); } catch {}
    try { userStats.messages = await db.message.count({ where: { senderId: userId } }); } catch {}
    try { userStats.likes = await db.like.count({ where: { userId } }); } catch {}
    try { userStats.comments = await db.comment.count({ where: { userId } }); } catch {}
    try { userStats.editRequests = await db.propertyEditRequest.count({ where: { userId } }); } catch {}

    // ========== Selective deletion ==========

    // 1. Delete apartments (and their related inquiries/payments/likes/comments via cascade)
    if (deleteOptions.apartments) {
      try {
        // First get all apartment IDs to delete their related data individually
        const userApartments = await db.apartment.findMany({
          where: { createdBy: userId },
          select: { id: true },
        });
        const aptIds = userApartments.map(a => a.id);

        if (aptIds.length > 0) {
          // Delete related data for user's apartments
          await db.comment.deleteMany({ where: { apartmentId: { in: aptIds } } });
          await db.like.deleteMany({ where: { apartmentId: { in: aptIds } } });
          if (!deleteOptions.inquiries) {
            // Only delete inquiries if apartments are deleted but inquiries option is off
            // Actually since apartments are being deleted, inquiries linked to them will be orphaned
            // We need to handle them
            await db.payment.deleteMany({ where: { inquiry: { apartmentId: { in: aptIds } } } });
            await db.inquiry.deleteMany({ where: { apartmentId: { in: aptIds } } });
          }
          await db.propertyEditRequest.deleteMany({ where: { apartmentId: { in: aptIds } } });
        }
        await db.apartment.deleteMany({ where: { createdBy: userId } });
      } catch (err) {
        console.error("Error deleting user apartments:", err);
      }
    }

    // 2. Delete payments (only if not already cascade-deleted with apartments)
    if (deleteOptions.payments) {
      try { await db.payment.deleteMany({ where: { userId } }); } catch {}
    }

    // 3. Delete inquiries (only if not already cascade-deleted with apartments)
    if (deleteOptions.inquiries) {
      try {
        // Delete payments linked to these inquiries first
        const userInquiries = await db.inquiry.findMany({
          where: { userId },
          select: { id: true },
        });
        const inqIds = userInquiries.map(i => i.id);
        if (inqIds.length > 0) {
          await db.payment.deleteMany({ where: { inquiryId: { in: inqIds } } });
        }
        await db.inquiry.deleteMany({ where: { userId } });
      } catch {}
    }

    // 4. Delete likes
    if (deleteOptions.likes) {
      try { await db.like.deleteMany({ where: { userId } }); } catch {}
    }

    // 5. Delete comments
    if (deleteOptions.comments) {
      try { await db.comment.deleteMany({ where: { userId } }); } catch {}
    }

    // 6. Delete messages
    if (deleteOptions.messages) {
      try { await db.message.deleteMany({ where: { senderId: userId } }); } catch {}
    }

    // 7. Delete edit requests
    if (deleteOptions.editRequests) {
      try { await db.propertyEditRequest.deleteMany({ where: { userId } }); } catch {}
    }

    // 8. Delete blocked users list
    if (deleteOptions.blockedUsers) {
      try { await db.blockedUser.deleteMany({ where: { userId } }); } catch {}
    }

    // Finally delete the user
    await db.user.delete({ where: { id: userId } });

    // Log the deletion with options
    try {
      await db.operationLog.create({
        data: {
          action: "DELETE_USER",
          entityType: "User",
          entityId: userId,
          details: JSON.stringify({
            userName: targetUser.name,
            identifier: targetUser.identifier,
            stats: userStats,
            deleteOptions,
          }),
          userId: currentUser.id,
        },
      });
    } catch {}

    // Notify all connected clients that a user was changed/deleted
    try {
      await notifyRealtime('user-changed', { deletedUserId: userId });
    } catch {}

    // Notify apartments changed
    try {
      await notifyRealtime('apartments-changed', { reason: 'user-deleted', userId });
    } catch {}

    // Build summary message
    const deletedItems: string[] = [];
    if (deleteOptions.apartments && userStats.apartments) deletedItems.push(`${userStats.apartments} عقار`);
    if (deleteOptions.payments && userStats.payments) deletedItems.push(`${userStats.payments} عملية دفع`);
    if (deleteOptions.inquiries && userStats.inquiries) deletedItems.push(`${userStats.inquiries} استفسار`);
    if (deleteOptions.likes && userStats.likes) deletedItems.push(`${userStats.likes} إعجاب`);
    if (deleteOptions.comments && userStats.comments) deletedItems.push(`${userStats.comments} تعليق`);
    if (deleteOptions.messages && userStats.messages) deletedItems.push(`${userStats.messages} رسالة`);

    const summary = deletedItems.length > 0
      ? `تم حذف المستخدم "${targetUser.name}" (تم حذف: ${deletedItems.join('، ')})`
      : `تم حذف المستخدم "${targetUser.name}" فقط`;

    return NextResponse.json({
      success: true,
      message: summary,
      deletedCounts: userStats,
      options: deleteOptions,
    });
  } catch (error) {
    console.error("Delete user error:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء حذف المستخدم" },
      { status: 500 }
    );
  }
}

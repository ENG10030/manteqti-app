import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { notifyRealtime } from "@/lib/realtime";

// حذف مستخدم مع خيار تحديد البيانات المراد حذفها (المطور فقط)
//
// ⚠️ ملاحظة مهمة عن Cascade:
// الموديلات اللي FK غير nullable (messages, likes, comments, editRequests, blockedUsers)
// هتتمسح تلقائياً لما المستخدم يتم حذفه (Cascade في الـ schema)
// لكن Apartments ممكن تتحفظ لأن createdBy nullable

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

    // 1. Apartments: إذا المطور مش عايز يمسح العقارات → نفصل الـ FK (orphan)
    //    لأن createdBy nullable، لو set null مش هيتحذفوا بالـ cascade
    if (deleteOptions.apartments) {
      try {
        // Get apartment IDs for cascade cleanup
        const userApartments = await db.apartment.findMany({
          where: { createdBy: userId },
          select: { id: true },
        });
        const aptIds = userApartments.map((a: { id: string }) => a.id);

        if (aptIds.length > 0) {
          // Delete related data on these apartments (comments, likes, edit requests by OTHER users)
          await db.comment.deleteMany({ where: { apartmentId: { in: aptIds } } });
          await db.like.deleteMany({ where: { apartmentId: { in: aptIds } } });
          await db.propertyEditRequest.deleteMany({ where: { apartmentId: { in: aptIds } } });
        }
        // Delete the apartments themselves
        await db.apartment.deleteMany({ where: { createdBy: userId } });
      } catch (err) {
        console.error("Error deleting user apartments:", err);
      }
    } else {
      // المطور مش عايز يمسح العقارات → نجعلها orphan (بدون مالك)
      // لازم نعمل ده قبل حذف المستخدم عشان cascade مايمسحهمش
      try {
        await db.apartment.updateMany({
          where: { createdBy: userId },
          data: { createdBy: null },
        });
      } catch (err) {
        console.error("Error orphaning apartments:", err);
      }
    }

    // 2. Delete payments
    if (deleteOptions.payments) {
      try {
        // Delete payments linked to user's inquiries
        const userInquiries = await db.inquiry.findMany({
          where: { userId },
          select: { id: true },
        });
        const inqIds = userInquiries.map(i => i.id);
        if (inqIds.length > 0) {
          await db.payment.deleteMany({ where: { inquiryId: { in: inqIds } } });
        }
        await db.payment.deleteMany({ where: { userId } });
      } catch {}
    }

    // 3. Delete inquiries (and their payments)
    if (deleteOptions.inquiries) {
      try {
        const userInquiries = await db.inquiry.findMany({
          where: { userId },
          select: { id: true },
        });
        const inqIds = userInquiries.map((i: { id: string }) => i.id);
        if (inqIds.length > 0) {
          await db.payment.deleteMany({ where: { inquiryId: { in: inqIds } } });
        }
        await db.inquiry.deleteMany({ where: { userId } });
      } catch {}
    }

    // 4-8: messages, likes, comments, editRequests, blockedUsers
    // ⚠️ هذه الموديلات ليها onDelete: Cascade في الـ schema
    // لكن بنحذفهم يدوياً هنا عشان نقدر نعمل log للعدد
    // لو المطور اختار لا يمسحهم...Cascade هيمسحهم على أي حال
    // لأن FK (userId/senderId) مش nullable
    const cascadeForced: string[] = [];
    
    if (deleteOptions.messages) {
      try {
        await db.message.deleteMany({ where: { senderId: userId } });
      } catch {}
    } else {
      cascadeForced.push('messages');
    }

    if (deleteOptions.likes) {
      try { await db.like.deleteMany({ where: { userId } }); } catch {}
    } else {
      cascadeForced.push('likes');
    }

    if (deleteOptions.comments) {
      try { await db.comment.deleteMany({ where: { userId } }); } catch {}
    } else {
      cascadeForced.push('comments');
    }

    if (deleteOptions.editRequests) {
      try { await db.propertyEditRequest.deleteMany({ where: { userId } }); } catch {}
    } else {
      cascadeForced.push('editRequests');
    }

    if (deleteOptions.blockedUsers) {
      try { await db.blockedUser.deleteMany({ where: { userId } }); } catch {}
    } else {
      cascadeForced.push('blockedUsers');
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
            cascadeForced: cascadeForced.length > 0 ? cascadeForced : undefined,
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
      cascadeForced: cascadeForced.length > 0 ? cascadeForced : undefined,
    });
  } catch (error) {
    console.error("Delete user error:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء حذف المستخدم" },
      { status: 500 }
    );
  }
}

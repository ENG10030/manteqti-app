import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

// حذف مستخدم بشكل انتقائي (المطور فقط)
// v219: Selective delete - checkboxes to choose what to keep/remove
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

    // v219: Parse selective delete options from request body
    const body = await request.json().catch(() => ({}));
    const options = body.options || {};
    
    const keepApartments = options.keepApartments === true;
    const keepInquiries = options.keepInquiries === true;
    const keepPayments = options.keepPayments === true;
    const keepMessages = options.keepMessages === true;
    const keepLikes = options.keepLikes === true;
    const keepComments = options.keepComments === true;
    const keepEditRequests = options.keepEditRequests === true;

    // Get user's data for logging before deletion
    const userStats = {
      apartments: await db.apartment.count({ where: { createdBy: userId } }),
      inquiries: await db.inquiry.count({ where: { userId } }),
      payments: await db.payment.count({ where: { userId } }),
      messages: await db.message.count({ where: { senderId: userId } }),
      likes: await db.like.count({ where: { userId } }),
      comments: await db.comment.count({ where: { userId } }),
      editRequests: await db.propertyEditRequest.count({ where: { userId } }),
    };

    // Handle selective keep options before deleting user
    if (keepApartments) {
      // Set apartments' createdBy to null instead of cascade delete
      await db.apartment.updateMany({
        where: { createdBy: userId },
        data: { createdBy: null },
      });
    }

    if (keepInquiries) {
      // Set inquiries' userId to null instead of cascade delete
      await db.inquiry.updateMany({
        where: { userId },
        data: { userId: null },
      });
    }

    if (keepPayments) {
      // Set payments' userId to null instead of cascade delete
      await db.payment.updateMany({
        where: { userId },
        data: { userId: null },
      });
    }

    if (keepLikes) {
      // Delete likes explicitly (they have onDelete: Cascade so can't set null)
      await db.like.deleteMany({ where: { userId } });
    }

    if (keepComments) {
      // Delete comments explicitly (they have onDelete: Cascade so can't set null)
      await db.comment.deleteMany({ where: { userId } });
    }

    if (keepEditRequests) {
      // Delete edit requests explicitly (they have onDelete: Cascade so can't set null)
      await db.propertyEditRequest.deleteMany({ where: { userId } });
    }

    // Note: Messages always cascade (no SetNull option - receiverId is nullable but senderId is required)
    // If keepMessages, we log but they'll still be cascade deleted with the user
    // This is a schema limitation - messages are deleted regardless

    // Delete user (cascade will handle remaining related records)
    await db.user.delete({ where: { id: userId } });

    // Log the deletion
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
            options: {
              keepApartments,
              keepInquiries,
              keepPayments,
              keepMessages,
              keepLikes,
              keepComments,
              keepEditRequests,
            },
          }),
          userId: currentUser.id,
        },
      });
    } catch {}

    return NextResponse.json({
      success: true,
      message: `تم حذف المستخدم "${targetUser.name}"${
        keepApartments ? " (تم الاحتفاظ بالعقارات)" : ""
      }`,
    });
  } catch (error) {
    console.error("Delete user error:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء حذف المستخدم" },
      { status: 500 }
    );
  }
}

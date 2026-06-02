import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { broadcastEvent, WebhookEvents } from "@/lib/webhook";

// حذف مستخدم (المطور فقط)
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

    // Get user's data for logging before deletion
    const userStats = {
      apartments: await db.apartment.count({ where: { createdBy: userId } }),
      inquiries: await db.inquiry.count({ where: { userId } }),
      payments: await db.payment.count({ where: { userId } }),
      messages: await db.message.count({ where: { senderId: userId } }),
    };

    // Delete user (cascade will handle related records)
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
          }),
          userId: currentUser.id,
        },
      });
    } catch {}

    try { await broadcastEvent(WebhookEvents.USER_CHANGED); } catch {}

    return NextResponse.json({
      success: true,
      message: `تم حذف المستخدم "${targetUser.name}" وجميع بياناته`,
    });
  } catch (error) {
    console.error("Delete user error:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء حذف المستخدم" },
      { status: 500 }
    );
  }
}

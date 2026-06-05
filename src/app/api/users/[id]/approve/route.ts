import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { notifyRealtime } from "@/lib/realtime";

// تأكيد أو رفض أو إلغاء تأكيد تسجيل مستخدم (للمطور فقط)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser(request);

    if (!currentUser || currentUser.role !== "DEVELOPER") {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const { id } = await params;
    const { action, reason } = await request.json();

    if (!["approve", "reject", "revoke"].includes(action)) {
      return NextResponse.json({ error: "إجراء غير صالح" }, { status: 400 });
    }

    const user = await db.user.findUnique({ where: { id } });

    if (!user) {
      return NextResponse.json({ error: "المستخدم غير موجود" }, { status: 404 });
    }

    if (user.role === "DEVELOPER") {
      return NextResponse.json({ error: "لا يمكن تعديل حساب المطور" }, { status: 400 });
    }

    if (action === "approve") {
      const updated = await db.user.update({
        where: { id },
        data: { isApproved: true },
        select: { id: true, name: true, email: true, isApproved: true },
      });

      // Log approval
      try {
        await db.operationLog.create({
          data: {
            action: "APPROVE_USER",
            entityType: "User",
            entityId: id,
            details: JSON.stringify({ userName: updated.name, email: updated.email }),
            userId: currentUser.id,
          },
        });
      } catch {}

      // Log to ApprovalLog
      try {
        await db.approvalLog.create({
          data: {
            userId: id,
            action: "approve",
            userName: updated.name,
            userEmail: updated.email || user.identifier,
            performedBy: currentUser.id,
          },
        });
      } catch {}

      // Notify user their account was approved
      try { await notifyRealtime('user-changed', { approvedUserId: id }); } catch {}

      return NextResponse.json({ message: "تم تأكيد التسجيل", user: updated });
    } else if (action === "revoke") {
      // Revoke approval - set isApproved to false
      const updated = await db.user.update({
        where: { id },
        data: { isApproved: false },
        select: { id: true, name: true, email: true, isApproved: true },
      });

      // Log revocation
      try {
        await db.operationLog.create({
          data: {
            action: "REVOKE_APPROVAL",
            entityType: "User",
            entityId: id,
            details: JSON.stringify({ userName: updated.name, email: updated.email, reason: reason || "إلغاء التأكيد" }),
            userId: currentUser.id,
          },
        });
      } catch {}

      // Log to ApprovalLog
      try {
        await db.approvalLog.create({
          data: {
            userId: id,
            action: "revoke",
            userName: updated.name,
            userEmail: updated.email || user.identifier,
            reason: reason || "إلغاء التأكيد",
            performedBy: currentUser.id,
          },
        });
      } catch {}

      // Notify user their approval was revoked
      try { await notifyRealtime('user-changed', { revokedUserId: id }); } catch {}

      return NextResponse.json({ message: "تم إلغاء تأكيد التسجيل", user: updated });
    } else {
      // Log rejection before deletion
      try {
        await db.operationLog.create({
          data: {
            action: "REJECT_USER",
            entityType: "User",
            entityId: id,
            details: JSON.stringify({ userName: user.name, email: user.email }),
            userId: currentUser.id,
          },
        });
      } catch {}

      // Log to ApprovalLog
      try {
        await db.approvalLog.create({
          data: {
            userId: id,
            action: "reject",
            userName: user.name,
            userEmail: user.email || user.identifier,
            reason: reason || "رفض التسجيل",
            performedBy: currentUser.id,
          },
        });
      } catch {}

      // Delete user and all their data (cascade)
      await db.user.delete({ where: { id } });

      // Notify all clients about user deletion
      try { await notifyRealtime('user-changed', { deletedUserId: id }); } catch {}

      return NextResponse.json({ message: "تم رفض التسجيل وحذف الحساب" });
    }
  } catch (error) {
    console.error("User approval error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

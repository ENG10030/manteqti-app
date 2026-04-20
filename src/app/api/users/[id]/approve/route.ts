import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

// تأكيد أو رفض تسجيل مستخدم (للمطور)
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
    const { action } = await request.json();

    if (!["approve", "reject"].includes(action)) {
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

      return NextResponse.json({ message: "تم تأكيد التسجيل", user: updated });
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

      // Delete user and all their data (cascade)
      await db.user.delete({ where: { id } });
      return NextResponse.json({ message: "تم رفض التسجيل وحذف الحساب" });
    }
  } catch (error) {
    console.error("User approval error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

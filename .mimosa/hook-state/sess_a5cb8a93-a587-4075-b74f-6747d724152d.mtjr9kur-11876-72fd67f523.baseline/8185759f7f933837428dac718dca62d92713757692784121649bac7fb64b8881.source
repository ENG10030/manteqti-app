import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

// GET: Fetch approval logs (developer only)
// DELETE: Delete a specific approval log entry (developer only)
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);

    if (!currentUser || currentUser.role !== "DEVELOPER") {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const action = searchParams.get("action");
    const limit = parseInt(searchParams.get("limit") || "100");

    const where: any = {};
    if (userId) where.userId = userId;
    if (action) where.action = action;

    let logs: any[] = [];
    try {
      logs = await db.approvalLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
      });
    } catch (tableError) {
      console.log("ApprovalLog table might not exist yet");
      return NextResponse.json([]);
    }

    return NextResponse.json(logs.map((log) => ({
      id: log.id,
      userId: log.userId,
      action: log.action,
      userName: log.userName,
      userEmail: log.userEmail,
      reason: log.reason,
      performedBy: log.performedBy,
      createdAt: log.createdAt instanceof Date ? log.createdAt.toISOString() : String(log.createdAt),
    })));
  } catch (error) {
    console.error("Error fetching approval logs:", error);
    return NextResponse.json([]);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);

    if (!currentUser || currentUser.role !== "DEVELOPER") {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const logId = searchParams.get("id");
    const clearAll = searchParams.get("clearAll");

    if (clearAll === "true") {
      // Clear all approval logs
      try {
        await db.approvalLog.deleteMany({});
        return NextResponse.json({ message: "تم حذف جميع سجلات التأكيد" });
      } catch {
        return NextResponse.json({ error: "فشل حذف السجلات" }, { status: 500 });
      }
    }

    if (!logId) {
      return NextResponse.json({ error: "معرف السجل مطلوب" }, { status: 400 });
    }

    try {
      await db.approvalLog.delete({ where: { id: logId } });
      return NextResponse.json({ message: "تم حذف سجل التأكيد" });
    } catch {
      return NextResponse.json({ error: "فشل حذف السجل" }, { status: 500 });
    }
  } catch (error) {
    console.error("Error deleting approval log:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

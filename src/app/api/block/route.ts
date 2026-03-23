import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verify } from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "manteqti-secret-key-2024";

async function isDeveloper(request: Request) {
  const cookieHeader = request.headers.get("cookie");
  const cookies = new URLSearchParams(cookieHeader?.replace(/; /g, "&") || "");
  const token = cookies.get("auth-token");

  if (!token) return false;

  try {
    const decoded = verify(token, JWT_SECRET) as { userId: string; role: string };
    if (decoded.role !== "DEVELOPER") return false;

    const user = await db.user.findUnique({
      where: { id: decoded.userId },
      select: { role: true },
    });

    return user?.role === "DEVELOPER";
  } catch {
    return false;
  }
}

// GET - جلب المحظورين
export async function GET(request: Request) {
  try {
    if (!(await isDeveloper(request))) {
      return NextResponse.json({ error: "غير مصرح لك" }, { status: 403 });
    }

    const blockedUsers = await db.user.findMany({
      where: { isBlocked: true },
      select: {
        id: true,
        name: true,
        email: true,
        blockedAt: true,
        blockReason: true,
        _count: {
          select: { apartments: true },
        },
      },
      orderBy: { blockedAt: "desc" },
    });

    return NextResponse.json({ blockedUsers });
  } catch (error) {
    console.error("Get blocked users error:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء جلب البيانات" },
      { status: 500 }
    );
  }
}

// POST - حظر/إلغاء حظر
export async function POST(request: Request) {
  try {
    if (!(await isDeveloper(request))) {
      return NextResponse.json({ error: "غير مصرح لك" }, { status: 403 });
    }

    const body = await request.json();
    const { userId, action, reason } = body;

    if (!userId || !action) {
      return NextResponse.json(
        { error: "معرف المستخدم والإجراء مطلوبان" },
        { status: 400 }
      );
    }

    if (action === "block") {
      const user = await db.user.update({
        where: { id: userId },
        data: {
          isBlocked: true,
          blockedAt: new Date(),
          blockReason: reason || "تم الحظر من قبل الإدارة",
        },
      });

      await db.apartment.updateMany({
        where: { createdBy: userId },
        data: { status: "BLOCKED" },
      });

      return NextResponse.json({
        message: "تم حظر المستخدم وإخفاء عقاراته",
        user: { id: user.id, name: user.name, email: user.email },
      });
    } else if (action === "unblock") {
      const user = await db.user.update({
        where: { id: userId },
        data: {
          isBlocked: false,
          blockedAt: null,
          blockReason: null,
        },
      });

      await db.apartment.updateMany({
        where: { createdBy: userId, status: "BLOCKED" },
        data: { status: "PENDING" },
      });

      return NextResponse.json({
        message: "تم إلغاء حظر المستخدم",
        user: { id: user.id, name: user.name, email: user.email },
      });
    } else {
      return NextResponse.json({ error: "إجراء غير صالح" }, { status: 400 });
    }
  } catch (error) {
    console.error("Block/unblock error:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء تنفيذ العملية" },
      { status: 500 }
    );
  }
}

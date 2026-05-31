import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verify } from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "manteqti-secret-key-2024";
const DEVELOPER_EMAIL = (process.env.DEVELOPER_EMAIL || "ahmadmamdouh10030@gmail.com").toLowerCase();

async function isDeveloper(request: Request) {
  const cookieHeader = request.headers.get("cookie");
  const cookies = new URLSearchParams(cookieHeader?.replace(/; /g, "&") || "");
  const token = cookies.get("auth-token");

  if (!token) return false;

  try {
    const decoded = verify(token, JWT_SECRET) as { userId: string; role?: string; identifier?: string };
    if (decoded.role === "DEVELOPER" || decoded.identifier === DEVELOPER_EMAIL) return true;

    const user = await db.user.findUnique({
      where: { id: decoded.userId },
      select: { role: true, identifier: true },
    });

    return user?.role === "DEVELOPER" || user?.identifier === DEVELOPER_EMAIL;
  } catch {
    return false;
  }
}

// ╔═══════════════════════════════════════════════════════════╗
// ║  دالة: فحص هل المستخدم المستهدف مطور (مزدوج)              ║
// ║  تتأكد من الـ role والـ identifier                         ║
// ╚═══════════════════════════════════════════════════════════╝
async function isTargetDeveloper(userId: string): Promise<boolean> {
  try {
    const target = await db.user.findUnique({
      where: { id: userId },
      select: { role: true, identifier: true },
    });
    if (!target) return false;
    return target.role === "DEVELOPER" || target.identifier === DEVELOPER_EMAIL;
  } catch {
    return false;
  }
}

// GET - جلب المحظورين أو جميع المستخدمين
export async function GET(request: Request) {
  try {
    if (!(await isDeveloper(request))) {
      return NextResponse.json({ error: "غير مصرح لك" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const getAll = searchParams.get("all");

    if (getAll === "true") {
      const users = await db.user.findMany({
        where: { role: { not: "DEVELOPER" } },
        select: {
          id: true,
          name: true,
          email: true,
          identifier: true,
          isBlocked: true,
          blockedAt: true,
          blockReason: true,
          createdAt: true,
          _count: { select: { apartments: true } },
        },
        orderBy: { createdAt: "desc" },
      });
      return NextResponse.json({ users });
    }

    const blockedUsers = await db.user.findMany({
      where: { isBlocked: true, role: { not: "DEVELOPER" }, identifier: { not: DEVELOPER_EMAIL } },
      select: {
        id: true,
        name: true,
        email: true,
        blockedAt: true,
        blockReason: true,
        _count: { select: { apartments: true } },
      },
      orderBy: { blockedAt: "desc" },
    });

    return NextResponse.json({ blockedUsers });
  } catch (error) {
    console.error("Get blocked users error:", error);
    return NextResponse.json({ error: "حدث خطأ أثناء جلب البيانات" }, { status: 500 });
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

    if (!userId) {
      return NextResponse.json({ error: "معرف المستخدم مطلوب" }, { status: 400 });
    }

    const finalAction = action || "block";

    if (finalAction === "block") {
      // ╔══════════════════════════════════════════════════════╗
      // ║  حماية مزدوجة: لا يمكن حظر المطور أبداً              ║
      // ║  يتأكد من الـ role والـ identifier                      ║
      // ╚══════════════════════════════════════════════════════╝
      if (await isTargetDeveloper(userId)) {
        return NextResponse.json({ error: "لا يمكن حظر مطور" }, { status: 403 });
      }

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
        data: { status: "hidden" },
      });

      return NextResponse.json({
        success: true,
        message: "تم حظر المستخدم وإخفاء عقاراته",
        user: { id: user.id, name: user.name, email: user.email },
      });
    } else if (finalAction === "unblock") {
      const user = await db.user.update({
        where: { id: userId },
        data: {
          isBlocked: false,
          blockedAt: null,
          blockReason: null,
        },
      });

      await db.apartment.updateMany({
        where: { createdBy: userId, status: "hidden" },
        data: { status: "pending" },
      });

      return NextResponse.json({
        success: true,
        message: "تم إلغاء حظر المستخدم",
        user: { id: user.id, name: user.name, email: user.email },
      });
    } else {
      return NextResponse.json({ error: "إجراء غير صالح" }, { status: 400 });
    }
  } catch (error) {
    console.error("Block/unblock error:", error);
    return NextResponse.json({ error: "حدث خطأ أثناء تنفيذ العملية" }, { status: 500 });
  }
}

// DELETE - إلغاء حظر مستخدم
export async function DELETE(request: Request) {
  try {
    if (!(await isDeveloper(request))) {
      return NextResponse.json({ error: "غير مصرح لك" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "معرف المستخدم مطلوب" }, { status: 400 });
    }

    const user = await db.user.update({
      where: { id: userId },
      data: {
        isBlocked: false,
        blockedAt: null,
        blockReason: null,
      },
    });

    await db.apartment.updateMany({
      where: { createdBy: userId, status: "hidden" },
      data: { status: "pending" },
    });

    return NextResponse.json({
      success: true,
      message: "تم إلغاء حظر المستخدم",
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (error) {
    console.error("Unblock error:", error);
    return NextResponse.json({ error: "حدث خطأ أثناء إلغاء الحظر" }, { status: 500 });
  }
}

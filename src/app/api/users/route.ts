import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

// جلب جميع المستخدمين (للمطور فقط)
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);

    if (!user || user.role !== "DEVELOPER") {
      return NextResponse.json(
        { error: "غير مصرح لك بهذا الإجراء" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const blocked = searchParams.get("blocked");
    const pending = searchParams.get("pending");

    // Always exclude DEVELOPER accounts from user list
    const whereClause: Record<string, unknown> = {
      role: { not: "DEVELOPER" },
    };

    if (blocked === "true") {
      whereClause.isBlocked = true;
    } else if (blocked === "false") {
      whereClause.isBlocked = false;
    }

    if (pending === "true") {
      whereClause.isApproved = false;
      whereClause.role = "USER";
    }

    const users = await db.user.findMany({
      where: whereClause,
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        identifier: true,
        role: true,
        isBlocked: true,
        isApproved: true,
        emailVerified: true,
        blockedAt: true,
        blockReason: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error("Get users error:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء جلب المستخدمين" },
      { status: 500 }
    );
  }
}

// ⛔ SECURITY: POST removed - registration must go through /api/auth/register
// which requires OTP email verification
export async function POST() {
  return NextResponse.json(
    { error: "استخدم /api/auth/register للتسجيل" },
    { status: 404 }
  );
}

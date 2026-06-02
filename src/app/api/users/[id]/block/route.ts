import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { db } from "@/lib/db"
import { broadcastEvent, WebhookEvents } from "@/lib/webhook"
import { sendUserBlockedEmail, sendUserUnblockedEmail } from '@/lib/email'

// حظر / إلغاء حظر المستخدم
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request)

    if (!user || user.role !== "DEVELOPER") {
      return NextResponse.json(
        { error: "غير مصرح لك بهذا الإجراء" },
        { status: 403 }
      )
    }

    const { id: userId } = await params
    const body = await request.json()
    const { action, reason } = body

    const targetUser = await db.user.findUnique({
      where: { id: userId }
    })

    if (!targetUser) {
      return NextResponse.json(
        { error: "المستخدم غير موجود" },
        { status: 404 }
      )
    }

    if (targetUser.role === "DEVELOPER") {
      return NextResponse.json(
        { error: "لا يمكن حظر مطور" },
        { status: 400 }
      )
    }

    const finalAction = action || "block"

    if (finalAction === "block") {
      await db.user.update({
        where: { id: userId },
        data: {
          isBlocked: true,
          blockedAt: new Date(),
          blockReason: reason || "تم الحظر من قبل الإدارة"
        }
      })

      await db.apartment.updateMany({
        where: { createdBy: userId },
        data: { status: "hidden" }
      })

      // Log block
      try {
        await db.operationLog.create({
          data: {
            action: "BLOCK_USER",
            entityType: "User",
            entityId: userId,
            details: JSON.stringify({ userName: targetUser.name, reason: reason || "حظر من المطور" }),
            userId: user.id,
          },
        });
      } catch {}

      try { await broadcastEvent(WebhookEvents.USER_CHANGED); } catch {}

      // إرسال إيميل حظر للمستخدم
      try { await sendUserBlockedEmail({ to: targetUser.email || '', name: targetUser.name, reason: reason || 'تم الحظر من قبل الإدارة' }); } catch {}

      return NextResponse.json({
        success: true,
        message: "تم حظر المستخدم وإخفاء جميع عقاراته"
      })

    } else if (finalAction === "unblock") {
      await db.user.update({
        where: { id: userId },
        data: {
          isBlocked: false,
          blockedAt: null,
          blockReason: null
        }
      })

      // Log unblock
      try {
        await db.operationLog.create({
          data: {
            action: "UNBLOCK_USER",
            entityType: "User",
            entityId: userId,
            details: JSON.stringify({ userName: targetUser.name }),
            userId: user.id,
          },
        });
      } catch {}

      try { await broadcastEvent(WebhookEvents.USER_CHANGED); } catch {}

      // إرسال إيميل إلغاء حظر للمستخدم
      try { await sendUserUnblockedEmail({ to: targetUser.email || '', name: targetUser.name }); } catch {}

      return NextResponse.json({
        success: true,
        message: "تم إلغاء حظر المستخدم"
      })

    } else {
      return NextResponse.json(
        { error: "إجراء غير صالح" },
        { status: 400 }
      )
    }

  } catch (error) {
    console.error("Block user error:", error)
    return NextResponse.json(
      { error: "حدث خطأ أثناء معالجة الطلب" },
      { status: 500 }
    )
  }
}

// جلب معلومات المستخدم
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request)

    if (!user || user.role !== "DEVELOPER") {
      return NextResponse.json(
        { error: "غير مصرح بك بهذا الإجراء" },
        { status: 403 }
      )
    }

    const { id: userId } = await params

    const userRecord = await db.user.findUnique({
      where: { id: userId }
    })

    if (!userRecord) {
      return NextResponse.json(
        { error: "المستخدم غير موجود" },
        { status: 404 }
      )
    }

    const apartments = await db.apartment.findMany({
      where: { createdBy: userId },
      orderBy: { createdAt: "desc" }
    })

    return NextResponse.json({
      user: userRecord,
      apartments
    })

  } catch (error) {
    console.error("Get user error:", error)
    return NextResponse.json(
      { error: "حدث خطأ أثناء جلب البيانات" },
      { status: 500 }
    )
  }
}

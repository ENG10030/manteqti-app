import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

// حظر / إلغاء حظر المستخدم
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user || session.user.role !== "developer") {
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

    if (targetUser.role === "developer") {
      return NextResponse.json(
        { error: "لا يمكن حظر مطور" },
        { status: 400 }
      )
    }

    if (action === "block") {
      // حظر المستخدم
      await db.user.update({
        where: { id: userId },
        data: {
          isBlocked: true,
          blockedAt: new Date(),
          blockedBy: session.user.id,
          blockedReason: reason || null
        }
      })

      // إخفاء جميع عقارات المستخدم
      await db.apartment.updateMany({
        where: { createdBy: userId },
        data: {
          isHidden: true,
          hiddenAt: new Date()
        }
      })

      // تسجيل المحتوى المحظور
      const blockedApartments = await db.apartment.findMany({
        where: { createdBy: userId }
      })

      for (const apartment of blockedApartments) {
        await db.blockedContent.create({
          data: {
            userId,
            apartmentId: apartment.id,
            blockedBy: session.user.id,
            action: "hidden",
            canRestore: true
          }
        })
      }

      return NextResponse.json({
        success: true,
        message: "تم حظر المستخدم وإخفاء جميع عقاراته"
      })

    } else if (action === "unblock") {
      // إلغاء حظر المستخدم
      await db.user.update({
        where: { id: userId },
        data: {
          isBlocked: false,
          blockedAt: null,
          blockedBy: null,
          blockedReason: null
        }
      })

      return NextResponse.json({
        success: true,
        message: "تم إلغاء حظر المستخدم. يمكنك الآن إدارة محتواه من لوحة التحكم."
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

// جلب معلومات المستخدم المحظور ومحتواه
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user || session.user.role !== "developer") {
      return NextResponse.json(
        { error: "غير مصرح لك بهذا الإجراء" },
        { status: 403 }
      )
    }

    const { id: userId } = await params

    const user = await db.user.findUnique({
      where: { id: userId },
      include: {
        apartments: {
          orderBy: { createdAt: "desc" }
        }
      }
    })

    if (!user) {
      return NextResponse.json(
        { error: "المستخدم غير موجود" },
        { status: 404 }
      )
    }

    const blockedContents = await db.blockedContent.findMany({
      where: { userId },
      include: {
        apartment: true
      }
    })

    return NextResponse.json({
      user,
      blockedContents
    })

  } catch (error) {
    console.error("Get blocked user error:", error)
    return NextResponse.json(
      { error: "حدث خطأ أثناء جلب البيانات" },
      { status: 500 }
    )
  }
}

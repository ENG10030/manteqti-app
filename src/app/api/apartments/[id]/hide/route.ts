import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

// إخفاء / إظهار محتوى المستخدم المحظور
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

    const { id: apartmentId } = await params
    const body = await request.json()
    const { action } = body // "hide" or "show"

    const apartment = await db.apartment.findUnique({
      where: { id: apartmentId },
      include: { creator: true }
    })

    if (!apartment) {
      return NextResponse.json(
        { error: "العقار غير موجود" },
        { status: 404 }
      )
    }

    // التحقق من أن المستخدم محظور
    if (!apartment.creator.isBlocked) {
      return NextResponse.json(
        { error: "هذا الإجراء متاح فقط للمستخدمين المحظورين" },
        { status: 400 }
      )
    }

    if (action === "hide") {
      const updatedApartment = await db.apartment.update({
        where: { id: apartmentId },
        data: {
          isHidden: true,
          hiddenAt: new Date()
        }
      })

      // تحديث أو إنشاء سجل المحتوى المحظور
      await db.blockedContent.upsert({
        where: { apartmentId },
        create: {
          userId: apartment.createdBy,
          apartmentId: apartment.id,
          blockedBy: session.user.id,
          action: "hidden",
          canRestore: true
        },
        update: {
          action: "hidden"
        }
      })

      return NextResponse.json({
        success: true,
        apartment: updatedApartment,
        message: "تم إخفاء العقار"
      })

    } else if (action === "show") {
      const updatedApartment = await db.apartment.update({
        where: { id: apartmentId },
        data: {
          isHidden: false,
          hiddenAt: null
        }
      })

      // تحديث سجل المحتوى المحظور
      await db.blockedContent.updateMany({
        where: { apartmentId },
        data: {
          action: "visible"
        }
      })

      return NextResponse.json({
        success: true,
        apartment: updatedApartment,
        message: "تم إظهار العقار"
      })

    } else {
      return NextResponse.json(
        { error: "إجراء غير صالح" },
        { status: 400 }
      )
    }

  } catch (error) {
    console.error("Hide/show apartment error:", error)
    return NextResponse.json(
      { error: "حدث خطأ أثناء معالجة الطلب" },
      { status: 500 }
    )
  }
}

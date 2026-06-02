import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { db } from "@/lib/db"
import { broadcastEvent, WebhookEvents } from "@/lib/webhook"

// تمييز / إلغاء تمييز عقار
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

    const { id: apartmentId } = await params
    const body = await request.json()
    const { action, featuredType } = body 
    // action: "feature" or "unfeature"
    // featuredType: "featured" or "vip"

    const apartment = await db.apartment.findUnique({
      where: { id: apartmentId }
    })

    if (!apartment) {
      return NextResponse.json(
        { error: "العقار غير موجود" },
        { status: 404 }
      )
    }

    if (action === "feature") {
      const isVip = featuredType === "vip"
      
      const updatedApartment = await db.apartment.update({
        where: { id: apartmentId },
        data: {
          isFeatured: true,
          isVip: isVip
        }
      })

      const typeLabel = isVip ? "VIP" : "مميز"
      
      try { await broadcastEvent(WebhookEvents.APARTMENTS_CHANGED); } catch {}
      return NextResponse.json({
        success: true,
        apartment: updatedApartment,
        message: `تم جعل العقار ${typeLabel}`
      })

    } else if (action === "unfeature") {
      const updatedApartment = await db.apartment.update({
        where: { id: apartmentId },
        data: {
          isFeatured: false,
          isVip: false
        }
      })

      try { await broadcastEvent(WebhookEvents.APARTMENTS_CHANGED); } catch {}

      return NextResponse.json({
        success: true,
        apartment: updatedApartment,
        message: "تم إلغاء تمييز العقار"
      })

    } else {
      return NextResponse.json(
        { error: "إجراء غير صالح" },
        { status: 400 }
      )
    }

  } catch (error) {
    console.error("Feature apartment error:", error)
    return NextResponse.json(
      { error: "حدث خطأ أثناء معالجة الطلب" },
      { status: 500 }
    )
  }
}

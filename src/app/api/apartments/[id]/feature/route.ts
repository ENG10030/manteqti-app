import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest, isDeveloperOrAdmin } from "@/lib/auth"
import { db } from "@/lib/db"

// تمييز / إلغاء تمييز عقار
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = authenticateRequest(request)

    if (!auth || !isDeveloperOrAdmin(auth.user)) {
      return NextResponse.json(
        { error: "غير مصرح لك بهذا الإجراء" },
        { status: 403 }
      )
    }

    const { id: apartmentId } = await params

    // ✅ Handle empty body gracefully
    let action = "feature"
    let featuredType: string | undefined = undefined
    try {
      const body = await request.json()
      action = body.action || "feature"
      featuredType = body.featuredType
    } catch {
      // Empty body - default to feature
    }

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

      return NextResponse.json({
        success: true,
        apartment: updatedApartment,
        message: "تم إلغاء تمييز العقار"
      })

    } else {
      return NextResponse.json(
        { error: "إجراء غير صالح. استخدم feature أو unfeature" },
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

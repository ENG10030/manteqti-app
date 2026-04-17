import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest, isDeveloperOrAdmin } from "@/lib/auth"
import { db } from "@/lib/db"

// إخفاء / إظهار عقار
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
    let action = "hide"
    try {
      const body = await request.json()
      action = body.action || "hide"
    } catch {
      // Empty body - default to hide
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

    if (action === "hide") {
      const updatedApartment = await db.apartment.update({
        where: { id: apartmentId },
        data: {
          status: "hidden"
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
          status: "available"
        }
      })

      return NextResponse.json({
        success: true,
        apartment: updatedApartment,
        message: "تم إظهار العقار"
      })

    } else {
      return NextResponse.json(
        { error: "إجراء غير صالح. استخدم hide أو show" },
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

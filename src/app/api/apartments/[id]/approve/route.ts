import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest, isDeveloperOrAdmin } from "@/lib/auth"
import { db } from "@/lib/db"

// الموافقة على / رفض عقار
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
    let action = "approve"
    try {
      const body = await request.json()
      action = body.action || "approve"
    } catch {
      // Empty body - default to approve
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

    if (action === "approve") {
      const updatedApartment = await db.apartment.update({
        where: { id: apartmentId },
        data: {
          status: "available",
          approvedBy: auth.user.id,
          approvedAt: new Date()
        }
      })

      return NextResponse.json({
        success: true,
        apartment: updatedApartment,
        message: "تم الموافقة على العقار"
      })

    } else if (action === "reject") {
      const updatedApartment = await db.apartment.update({
        where: { id: apartmentId },
        data: {
          status: "rejected"
        }
      })

      return NextResponse.json({
        success: true,
        apartment: updatedApartment,
        message: "تم رفض العقار"
      })

    } else {
      return NextResponse.json(
        { error: "إجراء غير صالح. استخدم approve أو reject" },
        { status: 400 }
      )
    }

  } catch (error) {
    console.error("Approve apartment error:", error)
    return NextResponse.json(
      { error: "حدث خطأ أثناء معالجة الطلب" },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { db } from "@/lib/db"

// إخفاء / إظهار عقار
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
    
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      body = { action: "hide" };
    }

    const { action } = body

    const apartment = await db.apartment.findUnique({
      where: { id: apartmentId }
    })

    if (!apartment) {
      return NextResponse.json(
        { error: "العقار غير موجود" },
        { status: 404 }
      )
    }

    if (action === "hide" || !action) {
      const updatedApartment = await db.apartment.update({
        where: { id: apartmentId },
        data: { status: "hidden" }
      })

      return NextResponse.json({
        success: true,
        apartment: updatedApartment,
        message: "تم إخفاء العقار"
      })

    } else if (action === "show") {
      const updatedApartment = await db.apartment.update({
        where: { id: apartmentId },
        data: { status: "available" }
      })

      return NextResponse.json({
        success: true,
        apartment: updatedApartment,
        message: "تم إظهار العقار"
      })

    } else {
      return NextResponse.json(
        { error: "إجراء غير صالح - استخدم action: hide أو show" },
        { status: 400 }
      )
    }

  } catch (error: any) {
    console.error("Hide/show apartment error:", error?.message || error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء معالجة الطلب" },
      { status: 500 }
    )
  }
}

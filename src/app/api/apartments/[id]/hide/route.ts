import { NextRequest, NextResponse } from "next/server"
import { verify } from "jsonwebtoken"
import { db } from "@/lib/db"

const JWT_SECRET = process.env.JWT_SECRET || "manteqti-secret-key-2024";

async function getCurrentUser(request: Request) {
  const cookieHeader = request.headers.get("cookie");
  const cookies = new URLSearchParams(cookieHeader?.replace(/; /g, "&") || "");
  const token = cookies.get("auth-token");
  if (!token) return null;
  try {
    const decoded = verify(token, JWT_SECRET) as { userId: string };
    return await db.user.findUnique({ where: { id: decoded.userId } });
  } catch {
    return null;
  }
}

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
    const body = await request.json()
    const { action } = body // "hide" or "show"

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

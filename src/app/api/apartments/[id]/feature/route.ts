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

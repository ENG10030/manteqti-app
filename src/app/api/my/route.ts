import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

// جلب عقارات المستخدم الحالي
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: "يجب تسجيل الدخول أولاً" },
        { status: 401 }
      )
    }

    const apartments = await db.apartment.findMany({
      where: {
        createdBy: session.user.id
      },
      orderBy: {
        createdAt: "desc"
      }
    })

    return NextResponse.json({ apartments })

  } catch (error) {
    console.error("Get my apartments error:", error)
    return NextResponse.json(
      { error: "حدث خطأ أثناء جلب عقاراتك" },
      { status: 500 }
    )
  }
}

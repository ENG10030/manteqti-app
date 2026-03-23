import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

// جلب معلومات الجلسة الحالية
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ user: null })
    }

    // جلب معلومات المستخدم المحدثة
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isBlocked: true,
        createdAt: true
      }
    })

    return NextResponse.json({ user })

  } catch (error) {
    console.error("Get session error:", error)
    return NextResponse.json({ user: null })
  }
}

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { hash } from "bcryptjs"

// جلب جميع المستخدمين (للمطور)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user || session.user.role !== "developer") {
      return NextResponse.json(
        { error: "غير مصرح لك بهذا الإجراء" },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const blocked = searchParams.get("blocked")

    let whereClause: Record<string, unknown> = {}

    if (blocked === "true") {
      whereClause.isBlocked = true
    } else if (blocked === "false") {
      whereClause.isBlocked = false
    }

    const users = await db.user.findMany({
      where: whereClause,
      orderBy: {
        createdAt: "desc"
      }
    })

    return NextResponse.json({ users })

  } catch (error) {
    console.error("Get users error:", error)
    return NextResponse.json(
      { error: "حدث خطأ أثناء جلب المستخدمين" },
      { status: 500 }
    )
  }
}

// إنشاء مستخدم جديد (تسجيل)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, password, phone, identifier } = body

    if (!email || !password || !identifier) {
      return NextResponse.json(
        { error: "البريد الإلكتروني وكلمة المرور والمعرف مطلوبون" },
        { status: 400 }
      )
    }

    // التحقق من عدم وجود المستخدم
    const existingUser = await db.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "البريد الإلكتروني مستخدم بالفعل" },
        { status: 400 }
      )
    }

    // التحقق من عدم وجود المعرف
    const existingIdentifier = await db.user.findUnique({
      where: { identifier }
    })

    if (existingIdentifier) {
      return NextResponse.json(
        { error: "المعرف مستخدم بالفعل" },
        { status: 400 }
      )
    }

    // تشفير كلمة المرور
    const hashedPassword = await hash(password, 12)

    // إنشاء المستخدم
    const user = await db.user.create({
      data: {
        identifier,
        name,
        email,
        password: hashedPassword,
        phone,
        role: "user"
      }
    })

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    })

  } catch (error) {
    console.error("Create user error:", error)
    return NextResponse.json(
      { error: "حدث خطأ أثناء إنشاء الحساب" },
      { status: 500 }
    )
  }
}

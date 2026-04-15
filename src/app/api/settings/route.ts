import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verify } from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "manteqti-secret-key-2024";
const DEVELOPER_EMAIL = "ahmadmamdouh10030@gmail.com";

async function isDeveloper(request: Request) {
  const cookieHeader = request.headers.get("cookie");
  const cookies = new URLSearchParams(cookieHeader?.replace(/; /g, "&") || "");
  const token = cookies.get("auth-token");

  if (!token) return false;

  try {
    const decoded = verify(token, JWT_SECRET) as { userId: string; role?: string; identifier?: string };
    
    if (decoded.role === "DEVELOPER" || decoded.identifier === DEVELOPER_EMAIL) return true;

    const user = await db.user.findUnique({
      where: { id: decoded.userId },
      select: { role: true, identifier: true },
    });

    return user?.role === "DEVELOPER" || user?.identifier === DEVELOPER_EMAIL;
  } catch {
    return false;
  }
}

// GET - جلب الإعدادات
export async function GET() {
  try {
    let settings = await db.settings.findFirst();

    if (!settings) {
      // استخدام as any لتجنب أخطاء TypeScript مع حقول مختلفة في schema
      const defaultData: Record<string, any> = {
        contactFee: 50,
        featuredFee: 100,
        vipFee: 300,
        premiumFee: 200,
        saleDisplayFee: 100,
        rentDisplayFee: 75,
        otherServicesFee: 50,
        highlightFee: 150,
        priorityListingFee: 200,
        verifiedListingFee: 250,
        currency: "ج.م",
      };
      settings = await db.settings.create({
        data: defaultData as any,
      });
    }

    return NextResponse.json({ settings });
  } catch (error) {
    console.error("Get settings error:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء جلب الإعدادات" },
      { status: 500 }
    );
  }
}

// PUT - تحديث الإعدادات
export async function PUT(request: Request) {
  try {
    if (!(await isDeveloper(request))) {
      return NextResponse.json({ error: "غير مصرح لك" }, { status: 403 });
    }

    const body = await request.json();

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
    }

    let settings = await db.settings.findFirst();

    // بناء updateData بشكل ديناميكي
    const updateData: Record<string, any> = {};

    const feeFields = [
      'contactFee', 'featuredFee', 'vipFee', 'premiumFee',
      'saleDisplayFee', 'rentDisplayFee', 'otherServicesFee',
      'highlightFee', 'priorityListingFee', 'verifiedListingFee'
    ];

    for (const field of feeFields) {
      if (body[field] !== undefined && body[field] !== null) {
        updateData[field] = Number(body[field]) || 0;
      }
    }

    if (body.currency !== undefined && body.currency !== null) {
      updateData.currency = String(body.currency);
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "لا توجد بيانات للتحديث" }, { status: 400 });
    }

    if (!settings) {
      const defaultData: Record<string, any> = {
        contactFee: 50,
        featuredFee: 100,
        vipFee: 300,
        premiumFee: 200,
        saleDisplayFee: 100,
        rentDisplayFee: 75,
        otherServicesFee: 50,
        highlightFee: 150,
        priorityListingFee: 200,
        verifiedListingFee: 250,
        currency: "ج.م",
      };
      settings = await db.settings.create({
        data: { ...defaultData, ...updateData } as any,
      });
    } else {
      settings = await db.settings.update({
        where: { id: settings.id },
        data: updateData as any,
      });
    }

    console.log("✅ Settings updated successfully:", JSON.stringify(updateData));

    return NextResponse.json({
      success: true,
      message: "تم تحديث الإعدادات بنجاح",
      settings,
    });
  } catch (error) {
    console.error("❌ Update settings error:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء تحديث الإعدادات", details: String(error) },
      { status: 500 }
    );
  }
}

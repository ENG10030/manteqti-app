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
      settings = await db.settings.create({
        data: {
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
        },
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

    // تحقق من وجود البيانات
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
    }

    let settings = await db.settings.findFirst();

    // بناء updateData - فقط الحقول الموجودة في الـ body
    const updateData: Record<string, any> = {};

    // لكل حقل: لو موجود في body (حتى لو قيمته 0) نستخدمه، ولو مش موجود نحتفظ بالقيمة الحالية
    if (body.contactFee !== undefined && body.contactFee !== null) updateData.contactFee = Number(body.contactFee) || 0;
    if (body.featuredFee !== undefined && body.featuredFee !== null) updateData.featuredFee = Number(body.featuredFee) || 0;
    if (body.vipFee !== undefined && body.vipFee !== null) updateData.vipFee = Number(body.vipFee) || 0;
    if (body.premiumFee !== undefined && body.premiumFee !== null) updateData.premiumFee = Number(body.premiumFee) || 0;
    if (body.saleDisplayFee !== undefined && body.saleDisplayFee !== null) updateData.saleDisplayFee = Number(body.saleDisplayFee) || 0;
    if (body.rentDisplayFee !== undefined && body.rentDisplayFee !== null) updateData.rentDisplayFee = Number(body.rentDisplayFee) || 0;
    if (body.otherServicesFee !== undefined && body.otherServicesFee !== null) updateData.otherServicesFee = Number(body.otherServicesFee) || 0;
    if (body.highlightFee !== undefined && body.highlightFee !== null) updateData.highlightFee = Number(body.highlightFee) || 0;
    if (body.priorityListingFee !== undefined && body.priorityListingFee !== null) updateData.priorityListingFee = Number(body.priorityListingFee) || 0;
    if (body.verifiedListingFee !== undefined && body.verifiedListingFee !== null) updateData.verifiedListingFee = Number(body.verifiedListingFee) || 0;
    if (body.currency !== undefined && body.currency !== null) updateData.currency = String(body.currency);

    // لو مفيش حقول محدثة
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "لا توجد بيانات للتحديث" }, { status: 400 });
    }

    if (!settings) {
      // إنشاء إعدادات جديدة مع القيم الافتراضية للم fields اللي مش موجودة
      settings = await db.settings.create({
        data: {
          contactFee: updateData.contactFee ?? 50,
          featuredFee: updateData.featuredFee ?? 100,
          vipFee: updateData.vipFee ?? 300,
          premiumFee: updateData.premiumFee ?? 200,
          saleDisplayFee: updateData.saleDisplayFee ?? 100,
          rentDisplayFee: updateData.rentDisplayFee ?? 75,
          otherServicesFee: updateData.otherServicesFee ?? 50,
          highlightFee: updateData.highlightFee ?? 150,
          priorityListingFee: updateData.priorityListingFee ?? 200,
          verifiedListingFee: updateData.verifiedListingFee ?? 250,
          currency: updateData.currency || "ج.م",
        },
      });
    } else {
      settings = await db.settings.update({
        where: { id: settings.id },
        data: updateData,
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

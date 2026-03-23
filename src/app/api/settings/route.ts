import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verify } from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "manteqti-secret-key-2024";

async function isDeveloper(request: Request) {
  const cookieHeader = request.headers.get("cookie");
  const cookies = new URLSearchParams(cookieHeader?.replace(/; /g, "&") || "");
  const token = cookies.get("auth-token");

  if (!token) return false;

  try {
    const decoded = verify(token, JWT_SECRET) as { userId: string; role: string };
    if (decoded.role !== "DEVELOPER") return false;

    const user = await db.user.findUnique({
      where: { id: decoded.userId },
      select: { role: true },
    });

    return user?.role === "DEVELOPER";
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
          siteName: "منطقتي",
          siteDescription: "منصة عقارية متكاملة",
          contactEmail: "info@manteqti.com",
          contactPhone: "+966500000000",
          featuredFee: 100,
          vipFee: 200,
          commissionRate: 5,
          minWithdrawal: 100,
          maxApartmentsPerUser: 10,
          allowUserRegistration: true,
          requireApproval: true,
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

    let settings = await db.settings.findFirst();

    if (!settings) {
      settings = await db.settings.create({
        data: {
          siteName: body.siteName || "منطقتي",
          siteDescription: body.siteDescription || "",
          contactEmail: body.contactEmail || "",
          contactPhone: body.contactPhone || "",
          featuredFee: body.featuredFee || 100,
          vipFee: body.vipFee || 200,
          commissionRate: body.commissionRate || 5,
          minWithdrawal: body.minWithdrawal || 100,
          maxApartmentsPerUser: body.maxApartmentsPerUser || 10,
          allowUserRegistration: body.allowUserRegistration ?? true,
          requireApproval: body.requireApproval ?? true,
        },
      });
    } else {
      settings = await db.settings.update({
        where: { id: settings.id },
        data: {
          siteName: body.siteName,
          siteDescription: body.siteDescription,
          contactEmail: body.contactEmail,
          contactPhone: body.contactPhone,
          featuredFee: body.featuredFee,
          vipFee: body.vipFee,
          commissionRate: body.commissionRate,
          minWithdrawal: body.minWithdrawal,
          maxApartmentsPerUser: body.maxApartmentsPerUser,
          allowUserRegistration: body.allowUserRegistration,
          requireApproval: body.requireApproval,
        },
      });
    }

    return NextResponse.json({
      message: "تم تحديث الإعدادات بنجاح",
      settings,
    });
  } catch (error) {
    console.error("Update settings error:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء تحديث الإعدادات" },
      { status: 500 }
    );
  }
}

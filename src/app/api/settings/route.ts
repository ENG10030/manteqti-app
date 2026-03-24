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
          contactFee: 50,
          featuredFee: 100,
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

    let settings = await db.settings.findFirst();

    if (!settings) {
      settings = await db.settings.create({
        data: {
          contactFee: body.contactFee || 50,
          featuredFee: body.featuredFee || 100,
          premiumFee: body.premiumFee || 200,
          saleDisplayFee: body.saleDisplayFee || 100,
          rentDisplayFee: body.rentDisplayFee || 75,
          otherServicesFee: body.otherServicesFee || 50,
          highlightFee: body.highlightFee || 150,
          priorityListingFee: body.priorityListingFee || 200,
          verifiedListingFee: body.verifiedListingFee || 250,
          currency: body.currency || "ج.م",
        },
      });
    } else {
      settings = await db.settings.update({
        where: { id: settings.id },
        data: {
          contactFee: body.contactFee,
          featuredFee: body.featuredFee,
          premiumFee: body.premiumFee,
          saleDisplayFee: body.saleDisplayFee,
          rentDisplayFee: body.rentDisplayFee,
          otherServicesFee: body.otherServicesFee,
          highlightFee: body.highlightFee,
          priorityListingFee: body.priorityListingFee,
          verifiedListingFee: body.verifiedListingFee,
          currency: body.currency,
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
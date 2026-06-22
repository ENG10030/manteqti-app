import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verify } from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;
const DEVELOPER_EMAIL = process.env.DEVELOPER_EMAIL || "ahmadmamdouh10030@gmail.com";

async function isDeveloper(request: Request): Promise<boolean> {
  const cookieHeader = request.headers.get("cookie");
  const cookies = new URLSearchParams(cookieHeader?.replace(/; /g, "&") || "");
  const token = cookies.get("auth-token");
  if (!token) return false;

  try {
    const decoded = verify(token, JWT_SECRET!) as unknown as { userId: string; role?: string; identifier?: string };
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

function validateFee(value: unknown): number {
  const num = parseInt(String(value));
  if (isNaN(num) || num < 0) return 0;
  return num;
}

function validateCurrency(value: unknown): string {
  if (typeof value !== 'string') return 'ج.م';
  const sanitized = value.replace(/<[^>]*>/g, '').trim().slice(0, 10);
  return sanitized || 'ج.م';
}

const DEFAULT_SETTINGS = {
  contactFee: 50,
  regularFee: 30,
  featuredFee: 100,
  premiumFee: 200,
  vipFee: 300,
  saleDisplayFee: 100,
  rentDisplayFee: 75,
  otherServicesFee: 50,
  highlightFee: 150,
  priorityListingFee: 200,
  verifiedListingFee: 250,
  currency: "ج.م",
};

// GET - جلب الإعدادات (public)
// يدعم الـ polling الفعال عبر ?since=timestamp
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const since = searchParams.get('since');

    let settings;
    try {
      settings = await db.settings.findFirst();
    } catch {
      settings = null;
    }

    if (!settings) {
      try {
        settings = await db.settings.create({ data: DEFAULT_SETTINGS });
      } catch {
        return NextResponse.json({
          settings: {
            id: 'default',
            ...DEFAULT_SETTINGS,
            usdtTronAddress: null,
            paymentAutoConfirm: false,
            paymentSecurityPin: null,
            walletMinCharge: 10,
            walletMaxCharge: 50000,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }
        });
      }
    }

    // 304: لو الإعدادات لم تتغير منذ آخر تحقق
    if (since) {
      const sinceDate = new Date(since);
      if (settings.updatedAt && !isNaN(sinceDate.getTime()) && settings.updatedAt <= sinceDate) {
        return new NextResponse(null, { status: 304 });
      }
    }

    return NextResponse.json(
      {
        settings: {
          ...settings,
          updatedAt: settings.updatedAt?.toISOString() || new Date().toISOString(),
        }
      },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate', 'Pragma': 'no-cache' } }
    );
  } catch (error) {
    console.error("Get settings error:", error);
    return NextResponse.json({ error: "حدث خطأ أثناء جلب الإعدادات" }, { status: 500 });
  }
}

// PUT - تحديث الإعدادات (developer only)
export async function PUT(request: Request) {
  try {
    if (!(await isDeveloper(request))) {
      return NextResponse.json({ error: "غير مصرح لك" }, { status: 403 });
    }

    const body = await request.json();

    // التحقق من صحة القيم
    const updateData: Record<string, unknown> = {
      contactFee: validateFee(body.contactFee),
      regularFee: validateFee(body.regularFee),
      featuredFee: validateFee(body.featuredFee),
      premiumFee: validateFee(body.premiumFee),
      vipFee: validateFee(body.vipFee),
      saleDisplayFee: validateFee(body.saleDisplayFee),
      rentDisplayFee: validateFee(body.rentDisplayFee),
      otherServicesFee: validateFee(body.otherServicesFee),
      highlightFee: validateFee(body.highlightFee),
      priorityListingFee: validateFee(body.priorityListingFee),
      verifiedListingFee: validateFee(body.verifiedListingFee),
      currency: validateCurrency(body.currency),
    };

    // تحديث أو إنشاء الإعدادات
    const existing = await db.settings.findFirst();

    let settings;
    if (!existing) {
      settings = await db.settings.create({ data: updateData });
    } else {
      settings = await db.settings.update({
        where: { id: existing.id },
        data: updateData,
      });
    }

    // تسجيل العملية (بدون تعطيل العملية لو فشل)
    try {
      const cookieHeader = request.headers.get("cookie");
      const cookies = new URLSearchParams(cookieHeader?.replace(/; /g, "&") || "");
      const token = cookies.get("auth-token");
      let userId: string | null = null;
      if (token) {
        try {
          const decoded = verify(token, JWT_SECRET!) as unknown as { userId: string };
          userId = decoded.userId;
        } catch {}
      }
      await db.operationLog.create({
        data: {
          action: 'UPDATE_SETTINGS',
          entityType: 'Settings',
          entityId: settings.id,
          userId,
          details: JSON.stringify(updateData),
        },
      });
    } catch {
      // ignore log errors
    }

    return NextResponse.json({
      message: "تم تحديث الإعدادات بنجاح ✅",
      settings,
    });
  } catch (error) {
    console.error("Update settings error:", error);
    return NextResponse.json({ error: "حدث خطأ أثناء تحديث الإعدادات" }, { status: 500 });
  }
}
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

function toInt(v: unknown): number {
  const n = parseInt(String(v));
  return isNaN(n) || n < 0 ? 0 : n;
}

function toCurrency(v: unknown): string {
  if (typeof v !== 'string') return 'ج.م';
  const s = v.replace(/<[^>]*>/g, '').trim().slice(0, 10);
  return s || 'ج.م';
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const since = searchParams.get('since');

    let settings;
    try { settings = await db.settings.findFirst(); } catch { settings = null; }

    if (!settings) {
      try {
        settings = await db.settings.create({
          data: { contactFee: 50, regularFee: 30, featuredFee: 100, premiumFee: 200, vipFee: 300, saleDisplayFee: 100, rentDisplayFee: 75, otherServicesFee: 50, highlightFee: 150, priorityListingFee: 200, verifiedListingFee: 250, currency: "ج.م" }
        });
      } catch {
        return NextResponse.json({ settings: { id: 'default', contactFee: 50, regularFee: 30, featuredFee: 100, premiumFee: 200, vipFee: 300, saleDisplayFee: 100, rentDisplayFee: 75, otherServicesFee: 50, highlightFee: 150, priorityListingFee: 200, verifiedListingFee: 250, currency: "ج.م", usdtTronAddress: null, paymentAutoConfirm: false, paymentSecurityPin: null, walletMinCharge: 10, walletMaxCharge: 50000, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } });
      }
    }

    if (since) {
      const sinceDate = new Date(since);
      if (settings.updatedAt && !isNaN(sinceDate.getTime()) && settings.updatedAt <= sinceDate) {
        return new NextResponse(null, { status: 304 });
      }
    }

    return NextResponse.json({ settings: { ...settings, updatedAt: settings.updatedAt?.toISOString() || new Date().toISOString() } }, { headers: { 'Cache-Control': 'no-store', 'Pragma': 'no-cache' } });
  } catch (error) {
    console.error("Get settings error:", error);
    return NextResponse.json({ error: "حدث خطأ أثناء جلب الإعدادات" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    if (!(await isDeveloper(request))) {
      return NextResponse.json({ error: "غير مصرح لك" }, { status: 403 });
    }

    const body = await request.json();

    const existing = await db.settings.findFirst();
    if (!existing) {
      return NextResponse.json({ error: "لا توجد إعدادات" }, { status: 404 });
    }

    const settings = await db.settings.update({
      where: { id: existing.id },
      data: {
        contactFee: toInt(body.contactFee),
        regularFee: toInt(body.regularFee),
        featuredFee: toInt(body.featuredFee),
        premiumFee: toInt(body.premiumFee),
        vipFee: toInt(body.vipFee),
        saleDisplayFee: toInt(body.saleDisplayFee),
        rentDisplayFee: toInt(body.rentDisplayFee),
        otherServicesFee: toInt(body.otherServicesFee),
        highlightFee: toInt(body.highlightFee),
        priorityListingFee: toInt(body.priorityListingFee),
        verifiedListingFee: toInt(body.verifiedListingFee),
        currency: toCurrency(body.currency),
        // Wallet/payment settings
        ...(body.usdtTronAddress !== undefined && { usdtTronAddress: typeof body.usdtTronAddress === 'string' ? body.usdtTronAddress.trim() || null : null }),
        ...(body.paymentAutoConfirm !== undefined && { paymentAutoConfirm: !!body.paymentAutoConfirm }),
        ...(body.paymentSecurityPin !== undefined && { paymentSecurityPin: typeof body.paymentSecurityPin === 'string' ? body.paymentSecurityPin.trim() || null : null }),
        ...(body.walletMinCharge !== undefined && { walletMinCharge: toInt(body.walletMinCharge) || 10 }),
        ...(body.walletMaxCharge !== undefined && { walletMaxCharge: toInt(body.walletMaxCharge) || 50000 }),
      },
    });

    return NextResponse.json({ message: "تم تحديث الإعدادات بنجاح ✅", settings });
  } catch (error) {
    console.error("Update settings error:", error);
    return NextResponse.json({ error: "حدث خطأ أثناء تحديث الإعدادات" }, { status: 500 });
  }
}
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verify } from "jsonwebtoken";
import { notifyRealtime } from "@/lib/realtime";
import { JWT_SECRET } from "@/lib/auth";

export const dynamic = "force-dynamic";

const DEVELOPER_EMAIL = process.env.DEVELOPER_EMAIL || "ahmadmamdouh10030@gmail.com";

async function isDeveloper(request: Request): Promise<boolean> {
  const cookieHeader = request.headers.get("cookie");
  const cookies = new URLSearchParams(cookieHeader?.replace(/; /g, "&") || "");
  const token = cookies.get("auth-token");
  if (!token) return false;
  try {
    const decoded = verify(token, JWT_SECRET) as unknown as { userId: string; role?: string; identifier?: string };
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

async function getCurrentUserId(request: Request): Promise<string | null> {
  const cookieHeader = request.headers.get("cookie");
  const cookies = new URLSearchParams(cookieHeader?.replace(/; /g, "&") || "");
  const token = cookies.get("auth-token");
  if (!token) return null;
  try {
    const decoded = verify(token, JWT_SECRET) as unknown as { userId: string };
    return decoded.userId;
  } catch {
    return null;
  }
}

function sanitize(value: unknown): string {
  if (typeof value === "string") return value.replace(/<[^>]*>/g, "").trim();
  return String(value ?? "");
}

function toNum(value: unknown): number {
  const num = parseInt(String(value));
  return isNaN(num) || num < 0 ? 0 : num;
}

// ==========================================
// GET - Fetch settings (single source of truth via Prisma)
// ==========================================
export async function GET() {
  try {
    const row = await db.settings.findFirst({ orderBy: { createdAt: "desc" } });
    if (row) {
      return NextResponse.json({
        settings: row,
        paymentMethods: buildPublicPaymentMethods(row),
      }, {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          "Pragma": "no-cache",
          "Expires": "0",
        },
      });
    }

    // No row exists — return defaults
    return NextResponse.json({
      settings: {
        contactFee: 50, regularFee: 30, featuredFee: 100, premiumFee: 200, vipFee: 300,
        saleDisplayFee: 100, rentDisplayFee: 75, otherServicesFee: 50,
        highlightFee: 150, priorityListingFee: 200, verifiedListingFee: 250,
        currency: "ج.م", id: "default",
      },
      paymentMethods: [],
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Get settings error:", error);
    return NextResponse.json({ error: "حدث خطأ أثناء جلب الإعدادات" }, { status: 500 });
  }
}

// ==========================================
// PUT - Update settings (single strategy: Prisma only)
// ==========================================
export async function PUT(request: Request) {
  try {
    if (!(await isDeveloper(request))) {
      return NextResponse.json({ error: "غير مصرح لك" }, { status: 403 });
    }

    const body = await request.json();

    // Sanitize all incoming data
    const updateData = {
      contactFee: toNum(body.contactFee),
      regularFee: toNum(body.regularFee),
      featuredFee: toNum(body.featuredFee),
      premiumFee: toNum(body.premiumFee),
      vipFee: toNum(body.vipFee),
      saleDisplayFee: toNum(body.saleDisplayFee),
      rentDisplayFee: toNum(body.rentDisplayFee),
      otherServicesFee: toNum(body.otherServicesFee),
      highlightFee: toNum(body.highlightFee),
      priorityListingFee: toNum(body.priorityListingFee),
      verifiedListingFee: toNum(body.verifiedListingFee),
      currency: sanitize(body.currency) || "ج.م",
      vodafoneCashNumber: sanitize(body.vodafoneCashNumber).replace(/[^0-9\s]/g, "").slice(0, 20),
      orangeCashNumber: sanitize(body.orangeCashNumber).replace(/[^0-9\s]/g, "").slice(0, 20),
      etisalatCashNumber: sanitize(body.etisalatCashNumber).replace(/[^0-9\s]/g, "").slice(0, 20),
      bankAccountName: sanitize(body.bankAccountName).slice(0, 100),
      bankAccountNumber: sanitize(body.bankAccountNumber).slice(0, 100),
      bankName: sanitize(body.bankName).slice(0, 100),
      instapayAccount: sanitize(body.instapayAccount).slice(0, 100),
      visaEnabled: body.visaEnabled === true,
      visaPublicKey: sanitize(body.visaPublicKey).slice(0, 100),
      visaSecretKey: sanitize(body.visaSecretKey).slice(0, 100),
      minRechargeAmount: Math.max(1, toNum(body.minRechargeAmount) || 10),
      maxRechargeAmount: Math.min(1000000, toNum(body.maxRechargeAmount) || 50000),
      usdtTronAddress: sanitize(body.usdtTronAddress).slice(0, 100),
      paymentAutoConfirm: body.paymentAutoConfirm === true,
      paymentSecurityPin: sanitize(body.paymentSecurityPin).replace(/\D/g, "").slice(0, 6),
    };

    // Find existing row — get ALL rows and clean up duplicates
    let targetId: string | null = null;
    try {
      const allRows = await db.settings.findMany({ orderBy: { createdAt: "desc" } });
      if (allRows.length > 0) {
        // Use the most recent row
        targetId = allRows[0].id;

        // 🔧 CLEANUP: If there are duplicate rows, delete older ones
        if (allRows.length > 1) {
          const olderIds = allRows.slice(1).map(r => r.id);
          try {
            await db.settings.deleteMany({ where: { id: { in: olderIds } } });
            console.log(`[Settings] Cleaned up ${olderIds.length} duplicate settings rows`);
          } catch (cleanupErr) {
            console.error("[Settings] Failed to clean duplicates:", cleanupErr);
          }
        }
      }
    } catch (findErr) {
      console.error("[Settings] Error finding rows:", findErr);
    }

    // Save — UPDATE if exists, CREATE if not
    let saved;
    try {
      if (targetId) {
        saved = await db.settings.update({
          where: { id: targetId },
          data: updateData,
        });
        console.log("[Settings] Updated existing row:", targetId);
      } else {
        saved = await db.settings.create({ data: updateData });
        console.log("[Settings] Created new row:", saved.id);
      }
    } catch (saveErr) {
      console.error("[Settings] Prisma save failed:", saveErr);
      // Last resort: try creating if update failed
      try {
        // Delete all existing rows and create fresh
        await db.settings.deleteMany({});
        saved = await db.settings.create({ data: updateData });
        console.log("[Settings] Recreated after cleanup:", saved.id);
      } catch (lastResortErr) {
        console.error("[Settings] Last resort failed:", lastResortErr);
        return NextResponse.json({ error: "فشل تحديث الإعدادات — جرب مرة أخرى" }, { status: 500 });
      }
    }

    // Log the change
    const currentUserId = await getCurrentUserId(request);
    try {
      await db.operationLog.create({
        data: {
          action: "UPDATE_SETTINGS",
          entityType: "Settings",
          entityId: saved.id,
          userId: currentUserId,
          details: JSON.stringify(updateData),
        },
      });
    } catch {}

    // Notify other clients
    notifyRealtime("settings-updated", updateData);

    return NextResponse.json({
      message: "تم تحديث الإعدادات بنجاح ✅",
      settings: saved,
    });
  } catch (error) {
    console.error("Update settings error:", error);
    return NextResponse.json({ error: "حدث خطأ أثناء تحديث الإعدادات" }, { status: 500 });
  }
}

// ==========================================
// Build payment methods for display
// ==========================================
function buildPublicPaymentMethods(s: any) {
  const methods: Array<{ id: string; name: string; icon: string; enabled: boolean; account?: string; color: string }> = [];

  if (s.vodafoneCashNumber) {
    methods.push({ id: "vodafone_cash", name: "فودافون كاش", icon: "📱", enabled: true, account: maskPhone(String(s.vodafoneCashNumber)), color: "from-red-500 to-red-600" });
  }
  if (s.orangeCashNumber) {
    methods.push({ id: "orange_cash", name: "أورنج كاش", icon: "🟠", enabled: true, account: maskPhone(String(s.orangeCashNumber)), color: "from-orange-500 to-orange-600" });
  }
  if (s.etisalatCashNumber) {
    methods.push({ id: "etisalat_cash", name: "اتصالات كاش", icon: "🔵", enabled: true, account: maskPhone(String(s.etisalatCashNumber)), color: "from-teal-500 to-cyan-600" });
  }
  if (s.bankAccountNumber && s.bankName) {
    methods.push({ id: "bank_transfer", name: "تحويل بنكي", icon: "🏦", enabled: true, account: String(s.bankName), color: "from-emerald-500 to-emerald-600" });
  }
  if (s.instapayAccount) {
    methods.push({ id: "instapay", name: "إنستاباي", icon: "⚡", enabled: true, account: maskInstapay(String(s.instapayAccount)), color: "from-violet-500 to-purple-600" });
  }
  if (s.usdtTronAddress) {
    methods.push({ id: "usdt_trc20", name: "USDT (TRC20)", icon: "🪙", enabled: true, account: String(s.usdtTronAddress).length > 10 ? String(s.usdtTronAddress).slice(0, 6) + "..." + String(s.usdtTronAddress).slice(-4) : String(s.usdtTronAddress), color: "from-amber-500 to-yellow-600" });
  }
  if (s.visaEnabled) {
    methods.push({ id: "visa", name: "فيزا / ماستركارد", icon: "💳", enabled: true, color: "from-slate-700 to-slate-900" });
  }

  return methods;
}

function maskPhone(phone: string): string {
  const cleaned = phone.replace(/\s/g, "");
  if (cleaned.length <= 6) return cleaned;
  return cleaned.slice(0, 4) + "****" + cleaned.slice(-2);
}

function maskInstapay(account: string): string {
  if (account.length <= 5) return account;
  return account.slice(0, 3) + "***" + account.slice(-2);
}

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

function v(value: unknown): string {
  if (typeof value === "string") return value.replace(/<[^>]*>/g, "").trim();
  return String(value ?? "");
}

function n(value: unknown): number {
  const num = parseInt(String(value));
  return isNaN(num) || num < 0 ? 0 : num;
}

// ==========================================
// GET - Fetch settings with multi-layer fallback
// ==========================================
export async function GET() {
  try {
    // Try Prisma
    try {
      const row = await db.settings.findFirst({ orderBy: { createdAt: "desc" } });
      if (row) {
        return NextResponse.json({
          settings: row,
          paymentMethods: buildPublicPaymentMethods(row as unknown as Record<string, unknown>),
        }, { headers: { "Cache-Control": "no-store, no-cache, must-revalidate", Pragma: "no-cache" } });
      }
    } catch (e) {
      console.error("GET settings Prisma failed:", e);
    }

    // Try raw SQL
    try {
      const rows = await db.$queryRawUnsafe(
        `SELECT * FROM "Settings" ORDER BY "createdAt" DESC LIMIT 1`
      ) as Array<Record<string, unknown>>;
      if (rows.length > 0) {
        return NextResponse.json({
          settings: rows[0],
          paymentMethods: buildPublicPaymentMethods(rows[0]),
        }, { headers: { "Cache-Control": "no-store, no-cache, must-revalidate", Pragma: "no-cache" } });
      }
    } catch (e) {
      console.error("GET settings raw SQL failed:", e);
    }

    // No row exists — return defaults (don't try to create to avoid write errors)
    return NextResponse.json({
      settings: { contactFee: 50, regularFee: 30, featuredFee: 100, premiumFee: 200, vipFee: 300, saleDisplayFee: 100, rentDisplayFee: 75, otherServicesFee: 50, highlightFee: 150, priorityListingFee: 200, verifiedListingFee: 250, currency: "ج.م", id: "default" },
      paymentMethods: [],
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Get settings error:", error);
    return NextResponse.json({ error: "حدث خطأ أثناء جلب الإعدادات" }, { status: 500 });
  }
}

// ==========================================
// PUT - Update settings with 3-strategy fallback
// Strategy 1: Prisma with ALL fields
// Strategy 2: Prisma with BASE fields only
// Strategy 3: Raw SQL field-by-field (skip missing columns)
// ==========================================
export async function PUT(request: Request) {
  try {
    if (!(await isDeveloper(request))) {
      return NextResponse.json({ error: "غير مصرح لك" }, { status: 403 });
    }

    const body = await request.json();

    // Validated full data
    const fullData = {
      contactFee: n(body.contactFee),
      regularFee: n(body.regularFee),
      featuredFee: n(body.featuredFee),
      premiumFee: n(body.premiumFee),
      vipFee: n(body.vipFee),
      saleDisplayFee: n(body.saleDisplayFee),
      rentDisplayFee: n(body.rentDisplayFee),
      otherServicesFee: n(body.otherServicesFee),
      highlightFee: n(body.highlightFee),
      priorityListingFee: n(body.priorityListingFee),
      verifiedListingFee: n(body.verifiedListingFee),
      currency: v(body.currency) || "ج.م",
      vodafoneCashNumber: v(body.vodafoneCashNumber).replace(/[^0-9\s]/g, "").slice(0, 20),
      orangeCashNumber: v(body.orangeCashNumber).replace(/[^0-9\s]/g, "").slice(0, 20),
      etisalatCashNumber: v(body.etisalatCashNumber).replace(/[^0-9\s]/g, "").slice(0, 20),
      bankAccountName: v(body.bankAccountName).slice(0, 100),
      bankAccountNumber: v(body.bankAccountNumber).slice(0, 100),
      bankName: v(body.bankName).slice(0, 100),
      instapayAccount: v(body.instapayAccount).slice(0, 100),
      visaEnabled: body.visaEnabled === true,
      visaPublicKey: v(body.visaPublicKey).slice(0, 100),
      visaSecretKey: v(body.visaSecretKey).slice(0, 100),
      minRechargeAmount: Math.max(1, n(body.minRechargeAmount) || 10),
      maxRechargeAmount: Math.min(1000000, n(body.maxRechargeAmount) || 50000),
      usdtTronAddress: v(body.usdtTronAddress).slice(0, 100),
      paymentAutoConfirm: body.paymentAutoConfirm === true,
      paymentSecurityPin: v(body.paymentSecurityPin).replace(/\D/g, "").slice(0, 6),
    };

    // Base-only data (guaranteed to exist in any schema)
    const baseData = {
      contactFee: fullData.contactFee,
      regularFee: fullData.regularFee,
      featuredFee: fullData.featuredFee,
      premiumFee: fullData.premiumFee,
      vipFee: fullData.vipFee,
      saleDisplayFee: fullData.saleDisplayFee,
      rentDisplayFee: fullData.rentDisplayFee,
      otherServicesFee: fullData.otherServicesFee,
      highlightFee: fullData.highlightFee,
      priorityListingFee: fullData.priorityListingFee,
      verifiedListingFee: fullData.verifiedListingFee,
      currency: fullData.currency,
    };

    // Find existing row
    let rowId: string | null = null;
    try {
      const row = await db.settings.findFirst({ orderBy: { createdAt: "desc" } });
      if (row) rowId = row.id;
    } catch {
      try {
        const rows = await db.$queryRawUnsafe(`SELECT "id" FROM "Settings" ORDER BY "createdAt" DESC LIMIT 1`) as Array<{ id: string }>;
        if (rows.length > 0) rowId = rows[0].id;
      } catch {}
    }

    let saved: Record<string, unknown> | null = null;

    // ==========================================
    // Strategy 1: Prisma UPDATE with ALL fields
    // ==========================================
    if (rowId) {
      try {
        saved = await db.settings.update({ where: { id: rowId }, data: fullData }) as unknown as Record<string, unknown>;
        console.log("Settings saved: Strategy 1 (Prisma full)");
      } catch (e) {
        console.warn("Strategy 1 failed:", (e as Error).message);
      }
    }

    // ==========================================
    // Strategy 2: Prisma UPDATE with BASE fields only
    // ==========================================
    if (!saved && rowId) {
      try {
        saved = await db.settings.update({ where: { id: rowId }, data: baseData }) as unknown as Record<string, unknown>;
        console.log("Settings saved: Strategy 2 (Prisma base)");

        // Now try extended fields one-by-one via raw SQL
        const extended: Record<string, unknown> = {};
        for (const [k, val] of Object.entries(fullData)) {
          if (!(k in baseData)) extended[k] = val;
        }
        for (const [col, val] of Object.entries(extended)) {
          try {
            const sqlVal = typeof val === "boolean" ? (val ? "TRUE" : "FALSE") : typeof val === "number" ? String(val) : `'${String(val).replace(/'/g, "''")}'`;
            await db.$executeRawUnsafe(`UPDATE "Settings" SET "${col}" = ${sqlVal} WHERE "id" = '${rowId}'`);
          } catch {
            // Column doesn't exist — skip it
          }
        }

        // Re-fetch to get all saved values
        try {
          const refetched = await db.settings.findFirst({ orderBy: { createdAt: "desc" } });
          if (refetched) saved = refetched as unknown as Record<string, unknown>;
        } catch {}
      } catch (e) {
        console.warn("Strategy 2 failed:", (e as Error).message);
      }
    }

    // ==========================================
    // Strategy 3: Create new row if none exists
    // ==========================================
    if (!saved && !rowId) {
      try {
        saved = await db.settings.create({ data: fullData }) as unknown as Record<string, unknown>;
        console.log("Settings saved: Strategy 3 (Prisma create)");
      } catch {
        try {
          saved = await db.settings.create({ data: baseData }) as unknown as Record<string, unknown>;
          console.log("Settings saved: Strategy 3b (Prisma create base)");
        } catch (e) {
          console.error("Strategy 3 failed:", (e as Error).message);
        }
      }
    }

    // ==========================================
    // Strategy 4: Raw SQL UPDATE field-by-field
    // ==========================================
    if (!saved && rowId) {
      console.log("Trying Strategy 4: Raw SQL field-by-field");
      for (const [col, val] of Object.entries(fullData)) {
        try {
          const sqlVal = typeof val === "boolean" ? (val ? "TRUE" : "FALSE") : typeof val === "number" ? String(val) : `'${String(val).replace(/'/g, "''")}'`;
          await db.$executeRawUnsafe(`UPDATE "Settings" SET "${col}" = ${sqlVal} WHERE "id" = '${rowId}'`);
        } catch {
          // Column doesn't exist — skip
        }
      }
      // Re-fetch
      try {
        const rows = await db.$queryRawUnsafe(`SELECT * FROM "Settings" WHERE "id" = '${rowId}' LIMIT 1`) as Array<Record<string, unknown>>;
        if (rows.length > 0) saved = rows[0];
        else saved = { id: rowId, ...fullData };
      } catch {
        saved = { id: rowId, ...fullData };
      }
      console.log("Settings saved: Strategy 4 (Raw SQL)");
    }

    // ==========================================
    // All strategies failed
    // ==========================================
    if (!saved) {
      return NextResponse.json({ error: "فشل تحديث الإعدادات — جرب مرة أخرى أو تواصل مع المطور" }, { status: 500 });
    }

    // Log
    const currentUserId = await getCurrentUserId(request);
    try {
      await db.operationLog.create({
        data: {
          action: "UPDATE_SETTINGS",
          entityType: "Settings",
          entityId: rowId || ((saved as Record<string, unknown>).id as string | null | undefined),
          userId: currentUserId,
          details: JSON.stringify(fullData),
        },
      });
    } catch {}

    notifyRealtime("settings-updated", fullData);

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
function buildPublicPaymentMethods(s: Record<string, unknown>) {
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

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verify } from "jsonwebtoken";
import { notifyRealtime } from "@/lib/realtime";
import { JWT_SECRET } from "@/lib/auth";

export const dynamic = "force-dynamic";

const DEVELOPER_EMAIL = process.env.DEVELOPER_EMAIL;

async function isDeveloper(request: Request): Promise<boolean> {
  const cookieHeader = request.headers.get("cookie");
  const cookies = new URLSearchParams(cookieHeader?.replace(/; /g, "&") || "");
  const token = cookies.get("auth-token");
  if (!token) return false;
  try {
    const decoded = verify(token, JWT_SECRET, { algorithms: ["HS256"] }) as unknown as { userId: string; role?: string; identifier?: string };
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
    const decoded = verify(token, JWT_SECRET, { algorithms: ["HS256"] }) as unknown as { userId: string };
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
// 🔧 AUTO-HEAL: Add missing columns to DB
// This replaces the old sync-schema endpoint
// ==========================================
const REQUIRED_COLUMNS: Record<string, { column: string; type: string; default: string }> = {
  vodafoneCashNumber:   { column: "vodafone_cash_number",   type: "TEXT",     default: "''" },
  orangeCashNumber:     { column: "orange_cash_number",     type: "TEXT",     default: "''" },
  etisalatCashNumber:   { column: "etisalat_cash_number",   type: "TEXT",     default: "''" },
  bankAccountName:      { column: "bank_account_name",      type: "TEXT",     default: "''" },
  bankAccountNumber:    { column: "bank_account_number",    type: "TEXT",     default: "''" },
  bankName:             { column: "bank_name",              type: "TEXT",     default: "''" },
  instapayAccount:      { column: "instapay_account",        type: "TEXT",     default: "''" },
  usdtTronAddress:      { column: "usdt_tron_address",       type: "TEXT",     default: "''" },
  visaEnabled:          { column: "visa_enabled",           type: "BOOLEAN",  default: "false" },
  visaPublicKey:        { column: "visa_public_key",         type: "TEXT",     default: "''" },
  visaSecretKey:        { column: "visa_secret_key",         type: "TEXT",     default: "''" },
  minRechargeAmount:    { column: "min_recharge_amount",     type: "INTEGER",  default: "10" },
  maxRechargeAmount:    { column: "max_recharge_amount",     type: "INTEGER",  default: "50000" },
  paymentAutoConfirm:   { column: "payment_auto_confirm",    type: "BOOLEAN",  default: "false" },
  paymentSecurityPin:   { column: "payment_security_pin",    type: "TEXT",     default: "''" },
};

async function autoHealDatabase(): Promise<number> {
  let added = 0;
  for (const [field, info] of Object.entries(REQUIRED_COLUMNS)) {
    try {
      const check = await db.$queryRawUnsafe(
        `SELECT column_name FROM information_schema.columns WHERE table_name = 'settings' AND column_name = '${info.column}'`
      ) as Array<{ column_name: string }>;

      if (check.length === 0) {
        await db.$executeRawUnsafe(
          `ALTER TABLE settings ADD COLUMN ${info.column} ${info.type} DEFAULT ${info.default}`
        );
        added++;
        console.log(`[Settings Auto-Heal] Added column: ${info.column}`);
      }
    } catch (err) {
      console.error(`[Settings Auto-Heal] Failed to add ${info.column}:`, err);
    }
  }
  return added;
}

// ==========================================
// GET - Fetch settings (public, stripped)
// ==========================================
export async function GET() {
  try {
    const row = await db.settings.findFirst({ orderBy: { createdAt: "desc" } });
    if (row) {
      // 🔒 Strip sensitive fields before returning to public
      const { visaSecretKey, visaPublicKey, paymentSecurityPin, vodafoneCashNumber, orangeCashNumber, etisalatCashNumber, bankAccountNumber, bankAccountName, instapayAccount, usdtTronAddress, ...publicSettings } = row;
      
      return NextResponse.json({
        settings: publicSettings,
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
// PUT - Update settings (AUTO-HEAL built-in)
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

    // ============================================
    // 🔧 AUTO-HEAL: Add missing columns first
    // ============================================
    const healedColumns = await autoHealDatabase();
    if (healedColumns > 0) {
      console.log(`[Settings] Auto-healed ${healedColumns} missing columns`);
    }

    // ============================================
    // STEP 1: Find or create the settings row
    // ============================================
    let targetId: string | null = null;
    try {
      const existing = await db.settings.findFirst({ orderBy: { createdAt: "desc" } });
      if (existing) {
        targetId = existing.id;
        // Clean up duplicate rows if any
        const allRows = await db.settings.findMany({ select: { id: true } });
        if (allRows.length > 1) {
          const otherIds = allRows.filter(r => r.id !== targetId).map(r => r.id);
          try { await db.settings.deleteMany({ where: { id: { in: otherIds } } }); } catch {}
          console.log(`[Settings] Cleaned ${otherIds.length} duplicate rows`);
        }
      }
    } catch (findErr) {
      console.error("[Settings] Find error:", findErr);
    }

    // ============================================
    // STEP 2: Save using UPDATE or CREATE
    // ============================================
    let saved;
    if (targetId) {
      try {
        saved = await db.settings.update({ where: { id: targetId }, data: updateData });
      } catch (updateErr) {
        console.error("[Settings] Prisma update failed, trying raw SQL:", updateErr);

        // FALLBACK: Raw SQL with snake_case column names
        try {
          const esc = (v: string) => v.replace(/'/g, "''");
          const strOrNull = (v: string) => v ? `'${esc(v)}'` : "NULL";

          await db.$executeRawUnsafe(`
            UPDATE settings SET
              contact_fee = ${updateData.contactFee},
              regular_fee = ${updateData.regularFee},
              featured_fee = ${updateData.featuredFee},
              premium_fee = ${updateData.premiumFee},
              vip_fee = ${updateData.vipFee},
              sale_display_fee = ${updateData.saleDisplayFee},
              rent_display_fee = ${updateData.rentDisplayFee},
              other_services_fee = ${updateData.otherServicesFee},
              highlight_fee = ${updateData.highlightFee},
              priority_listing_fee = ${updateData.priorityListingFee},
              verified_listing_fee = ${updateData.verifiedListingFee},
              currency = '${esc(updateData.currency)}',
              min_recharge_amount = ${updateData.minRechargeAmount},
              max_recharge_amount = ${updateData.maxRechargeAmount},
              vodafone_cash_number = ${strOrNull(updateData.vodafoneCashNumber)},
              orange_cash_number = ${strOrNull(updateData.orangeCashNumber)},
              etisalat_cash_number = ${strOrNull(updateData.etisalatCashNumber)},
              bank_account_name = ${strOrNull(updateData.bankAccountName)},
              bank_account_number = ${strOrNull(updateData.bankAccountNumber)},
              bank_name = ${strOrNull(updateData.bankName)},
              instapay_account = ${strOrNull(updateData.instapayAccount)},
              usdt_tron_address = ${strOrNull(updateData.usdtTronAddress)},
              visa_enabled = ${updateData.visaEnabled},
              visa_public_key = ${strOrNull(updateData.visaPublicKey)},
              visa_secret_key = ${strOrNull(updateData.visaSecretKey)},
              payment_auto_confirm = ${updateData.paymentAutoConfirm},
              payment_security_pin = ${strOrNull(updateData.paymentSecurityPin)}
            WHERE id = '${targetId}'
          `);

          saved = await db.settings.findFirst({ orderBy: { createdAt: "desc" } });
          console.log("[Settings] Saved via raw SQL fallback");
        } catch (sqlErr) {
          console.error("[Settings] Raw SQL also failed:", sqlErr);
          return NextResponse.json({
            error: "فشل تحديث الإعدادات",
          }, { status: 500 });
        }
      }
    } else {
      // No existing row — create new
      try {
        saved = await db.settings.create({ data: updateData });
      } catch (createErr) {
        console.error("[Settings] Create failed:", createErr);

        // FALLBACK: Raw SQL INSERT
        try {
          const esc = (v: string) => v.replace(/'/g, "''");
          const strOrNull = (v: string) => v ? `'${esc(v)}'` : "NULL";

          await db.$executeRawUnsafe(`
            INSERT INTO settings (
              id, contact_fee, regular_fee, featured_fee, premium_fee, vip_fee,
              sale_display_fee, rent_display_fee, other_services_fee,
              highlight_fee, priority_listing_fee, verified_listing_fee,
              currency, min_recharge_amount, max_recharge_amount,
              vodafone_cash_number, orange_cash_number, etisalat_cash_number,
              bank_account_name, bank_account_number, bank_name, instapay_account,
              usdt_tron_address, visa_enabled, visa_public_key, visa_secret_key,
              payment_auto_confirm, payment_security_pin
            ) VALUES (
              gen_random_uuid(),
              ${updateData.contactFee}, ${updateData.regularFee}, ${updateData.featuredFee},
              ${updateData.premiumFee}, ${updateData.vipFee}, ${updateData.saleDisplayFee},
              ${updateData.rentDisplayFee}, ${updateData.otherServicesFee},
              ${updateData.highlightFee}, ${updateData.priorityListingFee},
              ${updateData.verifiedListingFee}, '${esc(updateData.currency)}',
              ${updateData.minRechargeAmount}, ${updateData.maxRechargeAmount},
              ${strOrNull(updateData.vodafoneCashNumber)},
              ${strOrNull(updateData.orangeCashNumber)},
              ${strOrNull(updateData.etisalatCashNumber)},
              ${strOrNull(updateData.bankAccountName)},
              ${strOrNull(updateData.bankAccountNumber)},
              ${strOrNull(updateData.bankName)},
              ${strOrNull(updateData.instapayAccount)},
              ${strOrNull(updateData.usdtTronAddress)},
              ${updateData.visaEnabled}, ${strOrNull(updateData.visaPublicKey)},
              ${strOrNull(updateData.visaSecretKey)}, ${updateData.paymentAutoConfirm},
              ${strOrNull(updateData.paymentSecurityPin)}
            )
          `);

          saved = await db.settings.findFirst({ orderBy: { createdAt: "desc" } });
          console.log("[Settings] Created via raw SQL fallback");
        } catch (sqlErr2) {
          console.error("[Settings] Raw SQL INSERT also failed:", sqlErr2);
          return NextResponse.json({
            error: "فشل إنشاء الإعدادات",
          }, { status: 500 });
        }
      }
    }

    // Log the change — 🔒 Strip sensitive keys before logging
    const currentUserId = await getCurrentUserId(request);
    try {
      const { visaSecretKey, visaPublicKey, paymentSecurityPin, ...safeForLog } = updateData;
      await db.operationLog.create({
        data: {
          action: "UPDATE_SETTINGS",
          entityType: "Settings",
          entityId: saved!.id,
          userId: currentUserId,
          details: JSON.stringify(safeForLog),
        },
      });
    } catch {}

    // Notify other clients
    try { notifyRealtime("settings-updated", updateData); } catch {}

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

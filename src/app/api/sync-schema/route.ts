import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verify } from "jsonwebtoken";
import { JWT_SECRET } from "@/lib/auth";

export const dynamic = "force-dynamic";

// 🔧 One-time endpoint to sync Settings table columns with Prisma schema
// This fixes the root cause of "فشل تحديث الإعدادات"
// — Vercel build only runs `prisma generate`, NOT `prisma db push`
// — So new columns added to the schema don't exist in the database

async function isDeveloper(request: Request): Promise<boolean> {
  const cookieHeader = request.headers.get("cookie");
  const cookies = new URLSearchParams(cookieHeader?.replace(/; /g, "&") || "");
  const token = cookies.get("auth-token");
  if (!token) return false;
  try {
    const decoded = verify(token, JWT_SECRET, { algorithms: ["HS256"] }) as unknown as { role?: string };
    return decoded.role === "DEVELOPER";
  } catch {
    return false;
  }
}

// All Settings columns that should exist, mapped: Prisma field → PostgreSQL column name + type
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

export async function POST(request: Request) {
  try {
    if (!(await isDeveloper(request))) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const results: { column: string; status: string; error?: string }[] = [];
    let addedCount = 0;
    let existingCount = 0;

    // Check each column and add if missing
    for (const [field, info] of Object.entries(REQUIRED_COLUMNS)) {
      try {
        // Check if column exists
        const check = await db.$queryRawUnsafe(
          `SELECT column_name FROM information_schema.columns WHERE table_name = 'settings' AND column_name = '${info.column}'`
        ) as Array<{ column_name: string }>;

        if (check.length === 0) {
          // Column doesn't exist — add it
          await db.$executeRawUnsafe(
            `ALTER TABLE settings ADD COLUMN ${info.column} ${info.type} DEFAULT ${info.default}`
          );
          results.push({ column: info.column, status: "added ✅" });
          addedCount++;
        } else {
          results.push({ column: info.column, status: "exists" });
          existingCount++;
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        results.push({ column: info.column, status: "error ❌", error: msg });
      }
    }

    return NextResponse.json({
      success: true,
      message: addedCount > 0 
        ? `تم إضافة ${addedCount} أعمدة ناقصة بنجاح ✅` 
        : "كل الأعمدة موجودة بالفعل ✅",
      added: addedCount,
      existing: existingCount,
      total: Object.keys(REQUIRED_COLUMNS).length,
      details: results,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Sync schema error:", msg);
    return NextResponse.json({ error: "فشل مزامنة الأعمدة", details: msg }, { status: 500 });
  }
}

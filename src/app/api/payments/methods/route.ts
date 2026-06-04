import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// ==========================================
// Payment Methods API — Public Endpoint
// Returns available payment methods for the recharge modal
// All account details are masked — never expose full numbers
// ==========================================

// CORS headers for public access
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Handle CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// ==========================================
// Masking Utilities
// ==========================================
function maskPhone(phone: string): string {
  const cleaned = phone.replace(/\s/g, "");
  if (cleaned.length <= 6) return cleaned;
  return cleaned.slice(0, 4) + " **** " + cleaned.slice(-2);
}

function maskAccount(account: string): string {
  const cleaned = account.replace(/\s/g, "");
  if (cleaned.length <= 8) return cleaned;
  return cleaned.slice(0, 4) + " **** " + cleaned.slice(-4);
}

function maskInstapay(account: string): string {
  if (account.length <= 5) return account;
  return account.slice(0, 3) + "***" + account.slice(-2);
}

function maskTronAddress(address: string): string {
  const cleaned = address.replace(/\s/g, "");
  if (cleaned.length <= 10) return cleaned;
  return cleaned.slice(0, 6) + "..." + cleaned.slice(-4);
}

// ==========================================
// GET — Return Available Payment Methods
// ==========================================
export async function GET() {
  try {
    const settings = await db.settings.findFirst({ orderBy: { createdAt: "desc" } });

    if (!settings) {
      return NextResponse.json(
        { methods: [], limits: { min: 10, max: 50000 }, autoConfirm: false },
        {
          status: 200,
          headers: { ...CORS_HEADERS, "Cache-Control": "no-store" },
        }
      );
    }

    // Cast to access dynamic fields that may exist in DB but not in schema
    const s = settings as unknown as Record<string, any>;
    const minAmt = s.minRechargeAmount ?? 10;
    const maxAmt = s.maxRechargeAmount ?? 50000;

    type PaymentMethod = {
      id: string;
      name: string;
      nameEn: string;
      icon: string;
      enabled: boolean;
      account?: string;
      accountLabel?: string;
      instructions?: string;
      color: string;
      minAmount: number;
      maxAmount: number;
    };

    const methods: PaymentMethod[] = [];

    // Vodafone Cash
    if (s.vodafoneCashNumber) {
      const masked = maskPhone(s.vodafoneCashNumber);
      methods.push({
        id: "vodafone_cash",
        name: "فودافون كاش",
        nameEn: "Vodafone Cash",
        icon: "📱",
        enabled: true,
        account: masked,
        accountLabel: "رقم المحفظة",
        instructions: [
          "1. افتح تطبيق فودافون كاش",
          "2. اختر تحويل أموال",
          `3. أدخل الرقم: ${masked}`,
          "4. أدخل المبلغ وأرسل",
          "5. أدخل رقم المرجع هنا",
        ].join("\n"),
        color: "from-red-500 to-red-600",
        minAmount: minAmt,
        maxAmount: maxAmt,
      });
    }

    // Orange Cash
    if (s.orangeCashNumber) {
      const masked = maskPhone(s.orangeCashNumber);
      methods.push({
        id: "orange_cash",
        name: "أورنج كاش",
        nameEn: "Orange Cash",
        icon: "🟠",
        enabled: true,
        account: masked,
        accountLabel: "رقم المحفظة",
        instructions: [
          "1. افتح تطبيق أورنج كاش",
          "2. اختر تحويل أموال",
          `3. أدخل الرقم: ${masked}`,
          "4. أدخل المبلغ وأرسل",
          "5. أدخل رقم المرجع هنا",
        ].join("\n"),
        color: "from-orange-500 to-orange-600",
        minAmount: minAmt,
        maxAmount: maxAmt,
      });
    }

    // Etisalat Cash
    if (s.etisalatCashNumber) {
      const masked = maskPhone(s.etisalatCashNumber);
      methods.push({
        id: "etisalat_cash",
        name: "اتصالات كاش",
        nameEn: "Etisalat Cash",
        icon: "🔵",
        enabled: true,
        account: masked,
        accountLabel: "رقم المحفظة",
        instructions: [
          "1. افتح تطبيق اتصالات كاش",
          "2. اختر تحويل أموال",
          `3. أدخل الرقم: ${masked}`,
          "4. أدخل المبلغ وأرسل",
          "5. أدخل رقم المرجع هنا",
        ].join("\n"),
        color: "from-teal-500 to-cyan-600",
        minAmount: minAmt,
        maxAmount: maxAmt,
      });
    }

    // Bank Transfer
    if (s.bankAccountNumber && s.bankName) {
      methods.push({
        id: "bank_transfer",
        name: "تحويل بنكي",
        nameEn: "Bank Transfer",
        icon: "🏦",
        enabled: true,
        account: s.bankName,
        accountLabel: "اسم البنك",
        instructions: [
          "التحويل لحساب بنكي:",
          `🏦 البنك: ${s.bankName}`,
          `👤 صاحب الحساب: ${s.bankAccountName || "—"}`,
          `🔢 رقم الحساب: ${maskAccount(s.bankAccountNumber)}`,
          "",
          "⚠️ أدخل رقم إيصال التحويل",
        ].join("\n"),
        color: "from-emerald-500 to-emerald-600",
        minAmount: minAmt,
        maxAmount: maxAmt,
      });
    }

    // InstaPay
    if (s.instapayAccount) {
      const masked = maskInstapay(s.instapayAccount);
      methods.push({
        id: "instapay",
        name: "إنستاباي",
        nameEn: "InstaPay",
        icon: "⚡",
        enabled: true,
        account: masked,
        accountLabel: "رقم إنستاباي",
        instructions: [
          "1. افتح تطبيق إنستاباي",
          "2. اختر إرسال أموال",
          `3. ابحث عن: ${masked}`,
          "4. أدخل المبلغ وأرسل",
          "5. أدخل رقم المرجع هنا",
        ].join("\n"),
        color: "from-violet-500 to-purple-600",
        minAmount: minAmt,
        maxAmount: maxAmt,
      });
    }

    // USDT TRC20
    if (s.usdtTronAddress) {
      const masked = maskTronAddress(String(s.usdtTronAddress));
      methods.push({
        id: "usdt_trc20",
        name: "USDT (TRC20)",
        nameEn: "USDT Tether",
        icon: "🪙",
        enabled: true,
        account: masked,
        accountLabel: "عنوان Tron",
        instructions: [
          "إرسال USDT عبر شبكة TRC20:",
          `📍 العنوان: ${masked}`,
          "⚠️ تأكد من استخدام شبكة TRC20 فقط",
          "⚠️ لا ترسل عملات أخرى غير USDT",
          "",
          "أدخل رقم المعاملة (TxID) بعد الإرسال",
        ].join("\n"),
        color: "from-amber-500 to-yellow-600",
        minAmount: Math.max(minAmt, 5),
        maxAmount: maxAmt,
      });
    }

    // Visa / Mastercard
    methods.push({
      id: "visa",
      name: "بطاقة فيزا / ماستركارد",
      nameEn: "Visa / Mastercard",
      icon: "💳",
      enabled: s.visaEnabled === true,
      account: s.visaEnabled ? "دفع آمن بالبطاقة" : undefined,
      accountLabel: "بطاقة ائتمان",
      instructions: s.visaEnabled
        ? "سيتم خصم المبلغ من بطاقتك مباشرة"
        : "الدفع بالبطاقة غير متاح حالياً",
      color: "from-slate-700 to-slate-900",
      minAmount: minAmt,
      maxAmount: Math.min(maxAmt, 50000),
    });

    return NextResponse.json(
      {
        methods,
        limits: { min: minAmt, max: maxAmt },
        autoConfirm: s.paymentAutoConfirm === true,
      },
      {
        status: 200,
        headers: { ...CORS_HEADERS, "Cache-Control": "no-store" },
      }
    );
  } catch (error) {
    console.error("Payment methods GET error:", error);
    return NextResponse.json(
      { error: "حدث خطأ في جلب طرق الدفع المتاحة" },
      {
        status: 500,
        headers: { ...CORS_HEADERS, "Cache-Control": "no-store" },
      }
    );
  }
}

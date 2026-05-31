import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verify } from "jsonwebtoken";
import { notifyRealtime } from "@/lib/realtime";
import { JWT_SECRET } from "@/lib/auth";
const DEVELOPER_EMAIL = process.env.DEVELOPER_EMAIL || "ahmadmamdouh10030@gmail.com";

async function isDeveloper(request: Request): Promise<boolean> {
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

async function getCurrentUserId(request: Request): Promise<string | null> {
  const cookieHeader = request.headers.get("cookie");
  const cookies = new URLSearchParams(cookieHeader?.replace(/; /g, "&") || "");
  const token = cookies.get("auth-token");

  if (!token) return null;

  try {
    const decoded = verify(token, JWT_SECRET) as { userId: string };
    return decoded.userId;
  } catch {
    return null;
  }
}

function validateFee(value: unknown): number {
  const num = parseInt(String(value));
  if (isNaN(num) || num < 0) return 0;
  return num;
}

function validateCurrency(value: unknown): string {
  if (typeof value !== "string") return "ج.م";
  const sanitized = value.replace(/<[^>]*>/g, "").trim().slice(0, 10);
  return sanitized || "ج.م";
}

function validateAccountField(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/<[^>]*>/g, "").trim().slice(0, 100);
}

function validatePhoneNumber(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/[^0-9\s]/g, "").trim().slice(0, 20);
}

function validateTronAddress(value: unknown): string {
  if (typeof value !== "string") return "";
  // TRC20 addresses start with T and are 34 characters
  const cleaned = value.trim();
  if (!cleaned.startsWith("T")) return "";
  return cleaned.slice(0, 34);
}

function validateSecurityPin(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/\D/g, "").trim().slice(0, 6);
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
  vodafoneCashNumber: "",
  orangeCashNumber: "",
  etisalatCashNumber: "",
  bankAccountName: "",
  bankAccountNumber: "",
  bankName: "",
  instapayAccount: "",
  usdtTronAddress: "",
  visaEnabled: false,
  visaPublicKey: "",
  visaSecretKey: "",
  minRechargeAmount: 10,
  maxRechargeAmount: 50000,
  paymentAutoConfirm: false,
  paymentSecurityPin: "",
};

// GET - جلب الإعدادات (public - accounts masked for non-developers)
export async function GET() {
  try {
    let settings = await db.settings.findFirst({ orderBy: { createdAt: "desc" } });

    if (!settings) {
      settings = await db.settings.create({ data: DEFAULT_SETTINGS });
    }

    const paymentMethods = buildPublicPaymentMethods(settings);

    return NextResponse.json(
      { settings, paymentMethods },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          Pragma: "no-cache",
        },
      }
    );
  } catch (error) {
    console.error("Get settings error:", error);
    return NextResponse.json({ error: "حدث خطأ أثناء جلب الإعدادات" }, { status: 500 });
  }
}

function buildPublicPaymentMethods(s: Record<string, unknown>) {
  const methods: Array<{
    id: string;
    name: string;
    icon: string;
    enabled: boolean;
    account?: string;
    color: string;
  }> = [];

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
    methods.push({ id: "usdt_trc20", name: "USDT (TRC20)", icon: "🪙", enabled: true, account: maskTron(String(s.usdtTronAddress)), color: "from-amber-500 to-yellow-600" });
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

function maskTron(address: string): string {
  if (address.length <= 10) return address;
  return address.slice(0, 6) + "..." + address.slice(-4);
}

// PUT - تحديث الإعدادات (developer only)
export async function PUT(request: Request) {
  try {
    if (!(await isDeveloper(request))) {
      return NextResponse.json({ error: "غير مصرح لك" }, { status: 403 });
    }

    const body = await request.json();

    const validatedData = {
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
      // Payment receiving accounts
      vodafoneCashNumber: validatePhoneNumber(body.vodafoneCashNumber),
      orangeCashNumber: validatePhoneNumber(body.orangeCashNumber),
      etisalatCashNumber: validatePhoneNumber(body.etisalatCashNumber),
      bankAccountName: validateAccountField(body.bankAccountName),
      bankAccountNumber: validateAccountField(body.bankAccountNumber),
      bankName: validateAccountField(body.bankName),
      instapayAccount: validateAccountField(body.instapayAccount),
      usdtTronAddress: validateTronAddress(body.usdtTronAddress),
      visaEnabled: body.visaEnabled === true,
      visaPublicKey: validateAccountField(body.visaPublicKey),
      visaSecretKey: validateAccountField(body.visaSecretKey),
      minRechargeAmount: Math.max(1, validateFee(body.minRechargeAmount) || 10),
      maxRechargeAmount: Math.min(1000000, validateFee(body.maxRechargeAmount) || 50000),
      paymentAutoConfirm: body.paymentAutoConfirm === true,
      paymentSecurityPin: validateSecurityPin(body.paymentSecurityPin),
    };

    if (validatedData.minRechargeAmount > validatedData.maxRechargeAmount) {
      return NextResponse.json({ error: "الحد الأدنى يجب أن يكون أقل من الحد الأقصى" }, { status: 400 });
    }

    // Delete ALL existing settings, then create ONE fresh row
    await db.settings.deleteMany({});
    const settings = await db.settings.create({ data: validatedData });

    // Log
    const currentUserId = await getCurrentUserId(request);
    try {
      await db.operationLog.create({
        data: {
          action: "UPDATE_SETTINGS",
          entityType: "Settings",
          entityId: settings.id,
          userId: currentUserId,
          details: JSON.stringify(validatedData),
        },
      });
    } catch {}

    notifyRealtime("settings-updated", validatedData);

    return NextResponse.json({
      message: "تم تحديث الإعدادات بنجاح ✅",
      settings,
    });
  } catch (error) {
    console.error("Update settings error:", error);
    return NextResponse.json({ error: "حدث خطأ أثناء تحديث الإعدادات" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verify } from "jsonwebtoken";
import { JWT_SECRET } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// 🔐 Authenticate user
function authenticate(request: NextRequest) {
  const token = request.cookies.get("auth-token")?.value;
  if (!token) return null;
  try {
    return verify(token, JWT_SECRET, { algorithms: ["HS256"] }) as unknown as { userId: string; role: string; identifier: string };
  } catch {
    return null;
  }
}

// ========== Masking Utilities ==========
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

// ========== PUBLIC: GET enabled payment methods with receiving account info ==========
export async function GET() {
  try {
    const settings = await db.settings.findFirst({ orderBy: { createdAt: "desc" } });
    if (!settings) {
      return NextResponse.json({ methods: [], limits: { min: 10, max: 50000 } });
    }

    const methods: Array<{
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
    }> = [];

    const minAmt = settings.minRechargeAmount || 10;
    const maxAmt = settings.maxRechargeAmount || 50000;

    // Vodafone Cash
    if (settings.vodafoneCashNumber) {
      methods.push({
        id: "vodafone_cash",
        name: "فودافون كاش",
        nameEn: "Vodafone Cash",
        icon: "📱",
        enabled: true,
        account: maskPhone(settings.vodafoneCashNumber),
        accountLabel: "رقم المحفظة",
        instructions: `1. افتح تطبيق فودافون كاش\n2. اختر تحويل أموال\n3. أدخل الرقم: ${maskPhone(settings.vodafoneCashNumber)}\n4. أدخل المبلغ وأرسل\n5. أدخل رقم المرجع هنا`,
        color: "from-red-500 to-red-600",
        minAmount: minAmt,
        maxAmount: maxAmt,
      });
    }

    // Orange Cash
    if (settings.orangeCashNumber) {
      methods.push({
        id: "orange_cash",
        name: "أورنج كاش",
        nameEn: "Orange Cash",
        icon: "🟠",
        enabled: true,
        account: maskPhone(settings.orangeCashNumber),
        accountLabel: "رقم المحفظة",
        instructions: `1. افتح تطبيق أورنج كاش\n2. اختر تحويل أموال\n3. أدخل الرقم: ${maskPhone(settings.orangeCashNumber)}\n4. أدخل المبلغ وأرسل\n5. أدخل رقم المرجع هنا`,
        color: "from-orange-500 to-orange-600",
        minAmount: minAmt,
        maxAmount: maxAmt,
      });
    }

    // Etisalat Cash
    if (settings.etisalatCashNumber) {
      methods.push({
        id: "etisalat_cash",
        name: "اتصالات كاش",
        nameEn: "Etisalat Cash",
        icon: "🔵",
        enabled: true,
        account: maskPhone(settings.etisalatCashNumber),
        accountLabel: "رقم المحفظة",
        instructions: `1. افتح تطبيق اتصالات كاش\n2. اختر تحويل أموال\n3. أدخل الرقم: ${maskPhone(settings.etisalatCashNumber)}\n4. أدخل المبلغ وأرسل\n5. أدخل رقم المرجع هنا`,
        color: "from-teal-500 to-cyan-600",
        minAmount: minAmt,
        maxAmount: maxAmt,
      });
    }

    // Bank Transfer
    if (settings.bankAccountNumber && settings.bankName) {
      methods.push({
        id: "bank_transfer",
        name: "تحويل بنكي",
        nameEn: "Bank Transfer",
        icon: "🏦",
        enabled: true,
        account: settings.bankName,
        accountLabel: "اسم البنك",
        instructions: `التحويل لحساب بنكي:\n🏦 البنك: ${settings.bankName}\n👤 اسم صاحب الحساب: ${settings.bankAccountName || "—"}\n🔢 رقم الحساب: ${maskAccount(settings.bankAccountNumber)}\n\n⚠️ أدخل رقم إيصال التحويل`,
        color: "from-emerald-500 to-emerald-600",
        minAmount: minAmt,
        maxAmount: maxAmt,
      });
    }

    // InstaPay
    if (settings.instapayAccount) {
      methods.push({
        id: "instapay",
        name: "إنستاباي",
        nameEn: "InstaPay",
        icon: "⚡",
        enabled: true,
        account: maskInstapay(settings.instapayAccount),
        accountLabel: "رقم إنستاباي",
        instructions: `1. افتح تطبيق إنستاباي\n2. اختر إرسال أموال\n3. ابحث عن: ${maskInstapay(settings.instapayAccount)}\n4. أدخل المبلغ وأرسل\n5. أدخل رقم المرجع هنا`,
        color: "from-violet-500 to-purple-600",
        minAmount: minAmt,
        maxAmount: maxAmt,
      });
    }

    // USDT TRC20
    const sAny = settings as unknown as Record<string, unknown>;
    if (sAny.usdtTronAddress) {
      methods.push({
        id: "usdt_trc20",
        name: "USDT (TRC20)",
        nameEn: "USDT Tether",
        icon: "🪙",
        enabled: true,
        account: maskTronAddress(String(sAny.usdtTronAddress)),
        accountLabel: "عنوان Tron",
        instructions: `إرسال USDT عبر شبكة TRC20:\n📍 العنوان: ${maskTronAddress(String(sAny.usdtTronAddress))}\n⚠️ تأكد من استخدام شبكة TRC20 فقط\n⚠️ لا ترسل عملات أخرى غير USDT\n\nأدخل رقم المعاملة (TxID) بعد الإرسال`,
        color: "from-amber-500 to-yellow-600",
        minAmount: Math.max(minAmt, 5),
        maxAmount: maxAmt,
      });
    }

    // Visa / Mastercard
    if (settings.visaEnabled) {
      methods.push({
        id: "visa",
        name: "بطاقة فيزا / ماستركارد",
        nameEn: "Visa / Mastercard",
        icon: "💳",
        enabled: true,
        account: "دفع آمن بالبطاقة",
        accountLabel: "بطاقة ائتمان",
        instructions: "سيتم خصم المبلغ من بطاقتك مباشرة",
        color: "from-slate-700 to-slate-900",
        minAmount: minAmt,
        maxAmount: Math.min(maxAmt, 50000),
      });
    }

    return NextResponse.json({ methods, limits: { min: minAmt, max: maxAmt }, autoConfirm: sAny.paymentAutoConfirm === true });
  } catch (error) {
    console.error("Payment methods GET error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

// ========== PROCESS VISA PAYMENT ==========
export async function POST(request: NextRequest) {
  try {
    const decoded = authenticate(request);
    if (!decoded) {
      return NextResponse.json({ error: "يجب تسجيل الدخول" }, { status: 401 });
    }

    const body = await request.json();
    const { amount, cardNumber, cardExpiry, cardCvv, cardHolderName, action, transactionId } = body;

    // Rate limit: max 5 Visa payment attempts per 15 min per user
    const allowed = await checkRateLimit("visa-payment", "userId", decoded.userId, 5, 15 * 60);
    if (!allowed) {
      return NextResponse.json(
        { error: "تجاوزت عدد محاولات الدفع المسموح بها. حاول بعد 15 دقيقة." },
        { status: 429 }
      );
    }

    // Validate amount
    if (!amount || typeof amount !== "number" || !Number.isInteger(amount) || amount <= 0) {
      return NextResponse.json({ error: "المبلغ غير صالح" }, { status: 400 });
    }

    const settings = await db.settings.findFirst({ orderBy: { createdAt: "desc" } });
    const maxAmt = settings?.maxRechargeAmount || 50000;
    const minAmt = settings?.minRechargeAmount || 10;

    if (amount < minAmt) {
      return NextResponse.json({ error: `الحد الأدنى للشحنة ${minAmt} ج.م` }, { status: 400 });
    }
    if (amount > maxAmt) {
      return NextResponse.json({ error: `الحد الأقصى للشحنة ${maxAmt.toLocaleString()} ج.م` }, { status: 400 });
    }

    // Validate user
    const user = await db.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, walletBalance: true, isBlocked: true },
    });

    if (!user) return NextResponse.json({ error: "المستخدم غير موجود" }, { status: 404 });
    if (user.isBlocked) return NextResponse.json({ error: "حسابك محظور" }, { status: 403 });

    // Validate card action
    if (action === "validate_card") {
      const validation = validateCard(cardNumber, cardExpiry, cardCvv, cardHolderName);
      if (!validation.valid) {
        return NextResponse.json({ error: validation.message, field: validation.field }, { status: 400 });
      }
      return NextResponse.json({ valid: true, last4: cardNumber.replace(/\s/g, "").slice(-4), brand: validation.brand });
    }

    return NextResponse.json({ error: "إجراء غير صالح" }, { status: 400 });
  } catch (error) {
    console.error("Payment methods POST error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

// ========== Card Validation Utilities ==========
function validateCard(cardNumber: string, expiry: string, cvv: string, holderName: string): {
  valid: boolean;
  message: string;
  field?: string;
  brand?: string;
} {
  const cleanNumber = (cardNumber || "").replace(/[\s\-]/g, "");
  const cleanExpiry = (expiry || "").trim();
  const cleanCvv = (cvv || "").replace(/\s/g, "");
  const cleanName = (holderName || "").replace(/<[^>]*>/g, "").trim();

  if (!cleanNumber || cleanNumber.length < 13 || cleanNumber.length > 19) {
    return { valid: false, message: "رقم البطاقة غير صالح", field: "cardNumber" };
  }
  if (!/^\d+$/.test(cleanNumber)) {
    return { valid: false, message: "رقم البطاقة يجب أن يكون أرقام فقط", field: "cardNumber" };
  }
  if (/^(0{13,}|1{13,}|1234)/.test(cleanNumber)) {
    return { valid: false, message: "رقم البطاقة غير صالح", field: "cardNumber" };
  }
  if (!luhnCheck(cleanNumber)) {
    return { valid: false, message: "رقم البطاقة غير صالح", field: "cardNumber" };
  }
  const brand = detectCardBrand(cleanNumber);

  if (!cleanExpiry || !/^\d{2}\/\d{2}$/.test(cleanExpiry)) {
    return { valid: false, message: "صيغة تاريخ الانتهاء غير صحيحة (MM/YY)", field: "cardExpiry" };
  }
  const [expMonth, expYear] = cleanExpiry.split("/").map(Number);
  if (expMonth < 1 || expMonth > 12) {
    return { valid: false, message: "شهر الانتهاء غير صالح", field: "cardExpiry" };
  }
  const now = new Date();
  const currentYear = now.getFullYear() % 100;
  const currentMonth = now.getMonth() + 1;
  if (expYear < currentYear || (expYear === currentYear && expMonth < currentMonth)) {
    return { valid: false, message: "البطاقة منتهية الصلاحية", field: "cardExpiry" };
  }
  if (expYear > currentYear + 10) {
    return { valid: false, message: "تاريخ انتهاء غير منطقي", field: "cardExpiry" };
  }

  const expectedCvvLength = brand === "American Express" ? 4 : 3;
  if (!cleanCvv || !/^\d+$/.test(cleanCvv) || cleanCvv.length < expectedCvvLength || cleanCvv.length > 4) {
    return { valid: false, message: `رمز الأمان (CVV) يجب أن يكون ${expectedCvvLength} أرقام`, field: "cardCvv" };
  }
  if (/^(0{3,4}|1{3,4}|2{3,4}|3{3,4}|4{3,4}|5{3,4}|6{3,4}|7{3,4}|8{3,4}|9{3,4})$/.test(cleanCvv)) {
    return { valid: false, message: "رمز الأمان (CVV) غير صالح", field: "cardCvv" };
  }

  if (!cleanName || cleanName.length < 2) {
    return { valid: false, message: "اسم حامل البطاقة مطلوب", field: "cardHolderName" };
  }
  if (cleanName.length > 100) {
    return { valid: false, message: "اسم حامل البطاقة طويل جداً", field: "cardHolderName" };
  }
  if (!/[a-zA-Z\u0600-\u06FF]/.test(cleanName)) {
    return { valid: false, message: "اسم حامل البطاقة غير صالح", field: "cardHolderName" };
  }

  return { valid: true, message: "البطاقة صالحة", brand };
}

function luhnCheck(num: string): boolean {
  let sum = 0;
  let alternate = false;
  for (let i = num.length - 1; i >= 0; i--) {
    let n = parseInt(num[i], 10);
    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

function detectCardBrand(num: string): string {
  if (/^4/.test(num)) return "Visa";
  if (/^5[1-5]/.test(num) || /^2[2-7]/.test(num)) return "Mastercard";
  if (/^3[47]/.test(num)) return "American Express";
  if (/^6(?:011|5)/.test(num)) return "Discover";
  if (/^50(821|822|823|824|825|826|827|828)/.test(num)) return "Maestro";
  return "بطاقة";
}

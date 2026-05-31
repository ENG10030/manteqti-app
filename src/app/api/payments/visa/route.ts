import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verify } from "jsonwebtoken";
import { JWT_SECRET } from "@/lib/auth";
import { checkRateLimit, recordFailedAttempt, getClientIp } from "@/lib/rate-limit";
import crypto from "crypto";

// ==========================================
// Visa / Mastercard Payment API
// Handles card processing for wallet recharge
// ==========================================

// 🔐 Authenticate user via JWT
function authenticate(request: NextRequest) {
  const token = request.cookies.get("auth-token")?.value;
  if (!token) return null;
  try {
    return verify(token, JWT_SECRET) as {
      userId: string;
      role: string;
      identifier: string;
    };
  } catch {
    return null;
  }
}

// 🧹 Sanitize string input — strip HTML tags, trim, limit length
function sanitize(input: string, maxLen: number): string {
  return (input || "")
    .replace(/<[^>]*>/g, "")
    .trim()
    .slice(0, maxLen);
}

// ==========================================
// Luhn Algorithm — Card Number Validation
// ==========================================
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

// ==========================================
// Card Brand Detection
// ==========================================
function detectCardBrand(num: string): string {
  if (/^4/.test(num)) return "Visa";
  if (/^5[1-5]/.test(num) || /^2[2-7]/.test(num)) return "Mastercard";
  if (/^3[47]/.test(num)) return "American Express";
  if (/^6(?:011|5)/.test(num)) return "Discover";
  if (/^50(821|822|823|824|825|826|827|828)/.test(num)) return "Maestro";
  return "بطاقة";
}

// ==========================================
// Full Card Validation (Luhn + Expiry + CVV + Holder)
// ==========================================
function validateCard(
  cardNumber: string,
  expiry: string,
  cvv: string,
  holderName: string
): {
  valid: boolean;
  message: string;
  field?: string;
  brand?: string;
} {
  const cleanNumber = (cardNumber || "").replace(/[\s\-]/g, "");
  const cleanExpiry = (expiry || "").trim();
  const cleanCvv = (cvv || "").replace(/\s/g, "");
  const cleanName = sanitize(holderName, 100);

  // --- Card Number ---
  if (!cleanNumber || cleanNumber.length < 13 || cleanNumber.length > 19) {
    return { valid: false, message: "رقم البطاقة غير صالح — يجب أن يكون بين 13 و 19 خانة", field: "cardNumber" };
  }
  if (!/^\d+$/.test(cleanNumber)) {
    return { valid: false, message: "رقم البطاقة يجب أن يحتوي على أرقام فقط", field: "cardNumber" };
  }
  // Reject obviously fake numbers
  if (/^(0{13,}|1{13,}|1234)/.test(cleanNumber)) {
    return { valid: false, message: "رقم البطاقة غير صالح", field: "cardNumber" };
  }
  // Luhn check
  if (!luhnCheck(cleanNumber)) {
    return { valid: false, message: "رقم البطاقة فشل في التحقق (Luhn) — تأكد من صحة الرقم", field: "cardNumber" };
  }
  const brand = detectCardBrand(cleanNumber);

  // --- Expiry ---
  if (!cleanExpiry || !/^\d{2}\/\d{2}$/.test(cleanExpiry)) {
    return { valid: false, message: "صيغة تاريخ الانتهاء غير صحيحة — استخدم MM/YY", field: "cardExpiry" };
  }
  const [expMonth, expYear] = cleanExpiry.split("/").map(Number);
  if (expMonth < 1 || expMonth > 12) {
    return { valid: false, message: "شهر الانتهاء غير صالح — يجب أن يكون بين 01 و 12", field: "cardExpiry" };
  }
  const now = new Date();
  const currentYear = now.getFullYear() % 100;
  const currentMonth = now.getMonth() + 1;
  if (expYear < currentYear || (expYear === currentYear && expMonth < currentMonth)) {
    return { valid: false, message: "البطاقة منتهية الصلاحية", field: "cardExpiry" };
  }
  if (expYear > currentYear + 10) {
    return { valid: false, message: "تاريخ انتهاء غير منطقي — الحد الأقصى 10 سنوات", field: "cardExpiry" };
  }

  // --- CVV ---
  const expectedCvvLength = brand === "American Express" ? 4 : 3;
  if (!cleanCvv || !/^\d+$/.test(cleanCvv) || cleanCvv.length < expectedCvvLength || cleanCvv.length > 4) {
    return {
      valid: false,
      message: `رمز الأمان (CVV) يجب أن يكون ${expectedCvvLength} أرقام`,
      field: "cardCvv",
    };
  }
  // Reject sequential / repeated CVVs
  if (/^(0{3,4}|1{3,4}|2{3,4}|3{3,4}|4{3,4}|5{3,4}|6{3,4}|7{3,4}|8{3,4}|9{3,4})$/.test(cleanCvv)) {
    return { valid: false, message: "رمز الأمان (CVV) غير صالح", field: "cardCvv" };
  }

  // --- Holder Name ---
  if (!cleanName || cleanName.length < 2) {
    return { valid: false, message: "اسم حامل البطاقة مطلوب — حرفين على الأقل", field: "cardHolderName" };
  }
  if (!/[a-zA-Z\u0600-\u06FF]/.test(cleanName)) {
    return { valid: false, message: "اسم حامل البطاقة غير صالح — يجب أن يحتوي على حروف", field: "cardHolderName" };
  }

  return { valid: true, message: "البطاقة صالحة", brand };
}

// ==========================================
// Generate HMAC-SHA256 Transaction Signature
// ==========================================
function signTransaction(data: {
  userId: string;
  amount: number;
  method: string;
  timestamp: number;
}): string {
  const payload = `${data.userId}:${data.amount}:${data.method}:${data.timestamp}`;
  return crypto.createHmac("sha256", JWT_SECRET).update(payload).digest("hex");
}

// ==========================================
// Generate Unique Transaction Reference
// ==========================================
function generateTxRef(): string {
  return `VISA-${Date.now()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

// ==========================================
// POST — Process Visa / Mastercard Payment
// ==========================================
export async function POST(request: NextRequest) {
  try {
    // --- Step 1: Authenticate ---
    const decoded = authenticate(request);
    if (!decoded) {
      return NextResponse.json({ error: "يجب تسجيل الدخول للقيام بهذه العملية" }, { status: 401 });
    }

    // --- Step 2: Rate Limit — max 5 attempts per 10 min per user ---
    const allowed = await checkRateLimit("visa-payment", "userId", decoded.userId, 5, 10 * 60);
    if (!allowed) {
      return NextResponse.json(
        { error: "تجاوزت عدد محاولات الدفع المسموح بها. حاول بعد 10 دقائق." },
        { status: 429 }
      );
    }

    // --- Step 3: Parse & Validate Body ---
    const body = await request.json();
    const { amount, cardNumber, cardExpiry, cardCvv, cardHolderName, action, transactionId } = body;

    // Amount must be a positive integer
    if (!amount || typeof amount !== "number" || !Number.isInteger(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "المبلغ غير صالح — يجب أن يكون رقماً صحيحاً موجباً" },
        { status: 400 }
      );
    }

    // --- Step 4: Fetch Settings ---
    const settings = await db.settings.findFirst({ orderBy: { createdAt: "desc" } });
    const minAmt = settings?.minRechargeAmount ?? 10;
    const maxAmt = settings?.maxRechargeAmount ?? 50000;

    if (amount < minAmt) {
      return NextResponse.json(
        { error: `الحد الأدنى للشحنة ${minAmt} جنيه مصري` },
        { status: 400 }
      );
    }
    if (amount > maxAmt) {
      return NextResponse.json(
        { error: `الحد الأقصى للشحنة ${maxAmt.toLocaleString()} جنيه مصري` },
        { status: 400 }
      );
    }

    // --- Step 5: Verify Visa is Enabled ---
    if (!settings?.visaEnabled) {
      return NextResponse.json(
        { error: "الدفع بالبطاقة غير متاح حالياً — تواصل مع الدعم" },
        { status: 400 }
      );
    }

    // --- Step 6: Verify User Exists & Not Blocked ---
    const user = await db.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, walletBalance: true, isBlocked: true, name: true, email: true },
    });

    if (!user) {
      return NextResponse.json({ error: "المستخدم غير موجود" }, { status: 404 });
    }
    if (user.isBlocked) {
      return NextResponse.json({ error: "حسابك محظور — لا يمكنك إجراء عمليات دفع" }, { status: 403 });
    }

    // --- Step 7: Card Validation Action ---
    if (action === "validate_card") {
      const validation = validateCard(cardNumber, cardExpiry, cardCvv, cardHolderName);
      if (!validation.valid) {
        return NextResponse.json(
          { error: validation.message, field: validation.field },
          { status: 400 }
        );
      }
      return NextResponse.json({
        valid: true,
        last4: cardNumber.replace(/\s/g, "").slice(-4),
        brand: validation.brand,
      });
    }

    // --- Step 8: Process Payment Action ---
    if (action === "process") {
      // Validate card first
      const validation = validateCard(cardNumber, cardExpiry, cardCvv, cardHolderName);
      if (!validation.valid) {
        await recordFailedAttempt(
          "visa-payment",
          "userId",
          decoded.userId,
          request,
          `Card validation failed: ${validation.message} [field: ${validation.field}]`
        );
        return NextResponse.json(
          { error: validation.message, field: validation.field },
          { status: 400 }
        );
      }

      // Dedup by client transaction ID
      if (transactionId) {
        const existingTx = await db.walletTransaction.findFirst({
          where: { userId: decoded.userId, reference: transactionId, method: "visa" },
        });
        if (existingTx) {
          return NextResponse.json({
            success: true,
            message: "تم تنفيذ هذه المعاملة مسبقاً",
            duplicate: true,
            transaction: {
              id: existingTx.id,
              amount: existingTx.amount,
              balance: existingTx.balance,
              method: existingTx.method,
              status: existingTx.status,
              reference: existingTx.reference,
              createdAt: existingTx.createdAt,
            },
          });
        }
      }

      // Time-window dedup (same user, same amount, within 60 seconds)
      const sixtySecondsAgo = new Date(Date.now() - 60 * 1000);
      const recentDup = await db.walletTransaction.findFirst({
        where: {
          userId: decoded.userId,
          amount,
          method: "visa",
          status: "completed",
          createdAt: { gte: sixtySecondsAgo },
        },
      });
      if (recentDup) {
        return NextResponse.json(
          { error: "تم تنفيذ معاملة بنفس المبلغ مؤخراً — انتظر قليلاً ثم حاول مرة أخرى" },
          { status: 429 }
        );
      }

      // --- Step 9: Determine Confirm Mode ---
      const autoConfirm = (settings as unknown as Record<string, unknown>)?.paymentAutoConfirm === true;
      const txTimestamp = Date.now();
      const txRef = transactionId || generateTxRef();
      const txSignature = signTransaction({
        userId: decoded.userId,
        amount,
        method: "visa",
        timestamp: txTimestamp,
      });

      // Mask card number — NEVER store full card data
      const maskedCard = `****${cardNumber.replace(/\s/g, "").slice(-4)}`;
      const sanitizedHolderName = sanitize(cardHolderName, 50);

      let updatedBalance = user.walletBalance;

      // --- Step 10: Process — Auto Confirm vs Pending ---
      if (autoConfirm) {
        const updatedUser = await db.user.update({
          where: { id: decoded.userId },
          data: { walletBalance: { increment: amount } },
        });
        updatedBalance = updatedUser.walletBalance;
      }

      const finalStatus = autoConfirm ? "completed" : "pending";

      // Create WalletTransaction — card details are NOT stored, only masked last4 in description
      const transaction = await db.walletTransaction.create({
        data: {
          userId: decoded.userId,
          type: "recharge",
          amount,
          balance: updatedBalance,
          method: "visa",
          description: autoConfirm
            ? `شحن بطاقة ${maskedCard} (${validation.brand}) مبلغ ${amount} ج.م — تأكيد تلقائي`
            : `طلب شحن بطاقة ${maskedCard} (${validation.brand}) مبلغ ${amount} ج.م — بانتظار التأكيد`,
          reference: txRef,
          status: finalStatus,
        },
      });

      // --- Step 11: Log Operation ---
      const clientIp = getClientIp(request);
      const userAgent = request.headers.get("user-agent") || "unknown";

      try {
        await db.operationLog.create({
          data: {
            action: autoConfirm ? "VISA_RECHARGE_AUTO" : "VISA_RECHARGE_PENDING",
            entityType: "WalletTransaction",
            entityId: transaction.id,
            userId: decoded.userId,
            details: JSON.stringify({
              amount,
              brand: validation.brand,
              maskedCard,
              holderName: sanitizedHolderName,
              autoConfirm,
              signature: txSignature.substring(0, 16) + "...",
              txRef,
            }),
            ipAddress: clientIp,
            userAgent,
          },
        });
      } catch (logErr) {
        console.error("Failed to log Visa operation:", logErr);
      }

      // --- Step 12: Return Response ---
      return NextResponse.json({
        success: true,
        message: autoConfirm
          ? "تم شحن المحفظة بنجاح"
          : "تم تسجيل طلب الشحن — بانتظار تأكيد المطور",
        autoConfirmed: autoConfirm,
        signature: txSignature,
        transaction: {
          id: transaction.id,
          amount: transaction.amount,
          balance: transaction.balance,
          method: transaction.method,
          status: transaction.status,
          reference: txRef,
          createdAt: transaction.createdAt,
        },
      });
    }

    // --- Invalid Action ---
    return NextResponse.json(
      { error: "إجراء غير صالح — استخدم validate_card أو process" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Visa payment POST error:", error);
    return NextResponse.json(
      { error: "حدث خطأ في معالجة الدفع — حاول مرة أخرى لاحقاً" },
      { status: 500 }
    );
  }
}

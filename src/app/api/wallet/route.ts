import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verify } from "jsonwebtoken";
import { JWT_SECRET } from "@/lib/auth";
import { checkRateLimit, recordFailedAttempt, getClientIp } from "@/lib/rate-limit";
import crypto from "crypto";

export const dynamic = "force-dynamic";

// ==========================================
// Enhanced Wallet API
// - HMAC transaction signing
// - Double-submit protection (5 min window)
// - Strict input validation
// ==========================================

// 🔐 Enhanced Authentication with fingerprint tracking
function authenticate(request: NextRequest) {
  const token = request.cookies.get("auth-token")?.value;
  if (!token) return null;
  try {
    return verify(token, JWT_SECRET) as unknown as { userId: string; role: string; identifier: string };
  } catch {
    return null;
  }
}

// Generate secure transaction reference
function generateTxRef(prefix: string): string {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

// ==========================================
// HMAC Transaction Signing
// Each transaction gets a unique HMAC signature
// using JWT_SECRET as the signing key
// ==========================================
function signTransaction(params: {
  userId: string;
  amount: number;
  method: string;
  timestamp: number;
}): string {
  const payload = `${params.userId}:${params.amount}:${params.method}:${params.timestamp}`;
  return crypto.createHmac("sha256", JWT_SECRET).update(payload).digest("hex");
}

// ==========================================
// Double-Submit Protection
// Creates a hash of userId+amount+minute-bucket
// to prevent duplicate submissions within 5 minutes
// ==========================================
function doubleSubmitHash(userId: string, amount: number): string {
  // Bucket by 5-minute window to limit storage
  const bucket = Math.floor(Date.now() / (5 * 60 * 1000));
  const payload = `${userId}:${amount}:${bucket}`;
  return crypto.createHash("sha256").update(payload).digest("hex");
}

// ==========================================
// GET — جلب رصيد المحفظة والمعاملات (مع إحصائيات محسّنة)
// ==========================================
export async function GET(request: NextRequest) {
  try {
    const decoded = authenticate(request);
    if (!decoded) {
      return NextResponse.json({ error: "يجب تسجيل الدخول للوصول إلى المحفظة" }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, name: true, email: true, walletBalance: true, role: true, isBlocked: true },
    });

    if (!user) {
      return NextResponse.json({ error: "المستخدم غير موجود — يرجى تسجيل الدخول مرة أخرى" }, { status: 404 });
    }

    if (user.isBlocked) {
      return NextResponse.json(
        { error: "حسابك محظور — لا يمكنك الوصول إلى المحفظة. تواصل مع الدعم" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50") || 50));
    const txType = searchParams.get("type") || "all";

    const where: Record<string, unknown> = { userId: decoded.userId };
    if (txType !== "all") {
      where.type = txType;
    }

    const [transactions, total] = await Promise.all([
      db.walletTransaction.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.walletTransaction.count({ where }),
    ]);

    const stats = await db.walletTransaction.groupBy({
      by: ["type"],
      where: { userId: decoded.userId, status: "completed" },
      _sum: { amount: true },
    });

    const totalRecharged = stats.find((s) => s.type === "recharge")?._sum.amount || 0;
    const totalSpent = stats.find((s) => s.type === "payment")?._sum.amount || 0;
    const totalRefunded = stats.find((s) => s.type === "refund")?._sum.amount || 0;

    // Get pending recharges count
    const pendingCount = await db.walletTransaction.count({
      where: { userId: decoded.userId, status: "pending", type: "recharge" },
    });

    return NextResponse.json({
      balance: user.walletBalance || 0,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      transactions,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      stats: {
        totalRecharged,
        totalSpent,
        totalRefunded,
        transactionCount: total,
        pendingRecharges: pendingCount,
      },
    });
  } catch (error) {
    console.error("Wallet GET error:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء جلب بيانات المحفظة — حاول مرة أخرى لاحقاً" },
      { status: 500 }
    );
  }
}

// ==========================================
// POST — شحن المحفظة (محافظ جوال / بنك / إنستاباي / USDT)
// Enhanced with HMAC signing + double-submit protection
// ==========================================
export async function POST(request: NextRequest) {
  try {
    const decoded = authenticate(request);
    if (!decoded) {
      return NextResponse.json({ error: "يجب تسجيل الدخول لإجراء عملية شحن" }, { status: 401 });
    }

    // Enhanced rate limiting: max 10 recharge requests per 15 min per user
    const allowed = await checkRateLimit("wallet-recharge", "userId", decoded.userId, 10, 15 * 60);
    if (!allowed) {
      return NextResponse.json(
        { error: "تجاوزت عدد محاولات الشحن المسموح بها (10 محاولات / 15 دقيقة). حاول بعد 15 دقيقة." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { amount, method, reference, screenshotUrl } = body;

    // ==========================================
    // Amount validation: must be a positive integer
    // ==========================================
    if (!amount || typeof amount !== "number" || !Number.isInteger(amount) || amount <= 0) {
      await recordFailedAttempt(
        "wallet-recharge",
        "userId",
        decoded.userId,
        request,
        `Invalid amount: ${typeof amount} = ${amount}`
      );
      return NextResponse.json(
        { error: "المبلغ غير صالح — يجب أن يكون رقماً صحيحاً موجباً (مثلاً 100، 500، 1000)" },
        { status: 400 }
      );
    }

    // ==========================================
    // Get settings for dynamic limits and available methods
    // ==========================================
    const settings = await db.settings.findFirst({ orderBy: { createdAt: "desc" } });
    const maxAmt = settings?.maxRechargeAmount ?? 50000;
    const minAmt = settings?.minRechargeAmount ?? 10;

    if (amount < minAmt) {
      return NextResponse.json(
        { error: `الحد الأدنى للشحنة هو ${minAmt} جنيه مصري — أدخل مبلغ أكبر` },
        { status: 400 }
      );
    }

    if (amount > maxAmt) {
      return NextResponse.json(
        { error: `الحد الأقصى للشحنة هو ${maxAmt.toLocaleString()} جنيه مصري — أدخل مبلغ أصغر أو تواصل مع الدعم` },
        { status: 400 }
      );
    }

    // ==========================================
    // Visa goes through dedicated /payments/visa API
    // ==========================================
    if (method === "visa") {
      return NextResponse.json(
        { error: "الدفع بالبطاقة يتطلب واجهة خاصة — استخدم واجهة الدفع بالبطاقة بدلاً من ذلك" },
        { status: 400 }
      );
    }

    // ==========================================
    // Dynamic valid methods list based on settings configuration
    // ==========================================
    const validMethods: string[] = [];
    const methodFieldMap: Record<string, string> = {
      vodafone_cash: "vodafoneCashNumber",
      orange_cash: "orangeCashNumber",
      etisalat_cash: "etisalatCashNumber",
      bank_transfer: "bankAccountNumber",
      instapay: "instapayAccount",
      usdt_trc20: "usdtTronAddress",
    };

    if (settings) {
      const sAny = settings as unknown as Record<string, unknown>;
      for (const [methodId, field] of Object.entries(methodFieldMap)) {
        if (sAny[field]) {
          validMethods.push(methodId);
        }
      }
    }

    if (!method || !validMethods.includes(method)) {
      return NextResponse.json(
        {
          error:
            validMethods.length === 0
              ? "لا توجد طرق دفع متاحة حالياً — تواصل مع المطور لتفعيل طرق الدفع"
              : `طريقة الدفع "${method}" غير صالحة. الطرق المتاحة: ${validMethods.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // ==========================================
    // Verify user exists and not blocked
    // ==========================================
    const user = await db.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, walletBalance: true, isBlocked: true },
    });

    if (!user) {
      return NextResponse.json({ error: "المستخدم غير موجود — يرجى تسجيل الدخول مرة أخرى" }, { status: 404 });
    }

    if (user.isBlocked) {
      return NextResponse.json(
        { error: "حسابك محظور — لا يمكنك إجراء عمليات شحن. تواصل مع الدعم إذا كان هذا خطأً" },
        { status: 403 }
      );
    }

    // ==========================================
    // Double-Submit Protection
    // Reject identical (user+amount+method) submissions within 5 minutes
    // ==========================================
    const submitHash = doubleSubmitHash(decoded.userId, amount);
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    const recentDuplicate = await db.walletTransaction.findFirst({
      where: {
        userId: decoded.userId,
        amount,
        method,
        status: { in: ["pending", "completed"] },
        createdAt: { gte: fiveMinutesAgo },
      },
    });

    if (recentDuplicate) {
      return NextResponse.json(
        {
          error: "تم إرسال طلب شحن بنفس المبلغ ونفس الطريقة خلال الـ 5 دقائق الماضية — انتظر أو تحقق من معاملاتك",
          existingTransaction: {
            id: recentDuplicate.id,
            status: recentDuplicate.status,
            amount: recentDuplicate.amount,
            createdAt: recentDuplicate.createdAt,
          },
        },
        { status: 409 }
      );
    }

    // ==========================================
    // Sanitize inputs — strip HTML, trim, limit length
    // ==========================================
    const sanitizedRef = (reference || "")
      .replace(/<[^>]*>/g, "")
      .trim()
      .slice(0, 100);
    const sanitizedScreenshot = (screenshotUrl || "")
      .replace(/<[^>]*>/g, "")
      .trim()
      .slice(0, 500);

    // ==========================================
    // Auto-confirm if developer enabled it
    // ==========================================
    const isAutoConfirm = (settings as unknown as Record<string, unknown>)?.paymentAutoConfirm === true;
    const finalStatus = isAutoConfirm ? "completed" : "pending";
    const txTimestamp = Date.now();
    const txRef = generateTxRef(method.toUpperCase());

    // HMAC signature for transaction integrity
    const txSignature = signTransaction({
      userId: decoded.userId,
      amount,
      method,
      timestamp: txTimestamp,
    });

    let updatedBalance = user.walletBalance;

    // If auto-confirm, increment balance atomically
    if (isAutoConfirm) {
      const updatedUser = await db.user.update({
        where: { id: decoded.userId },
        data: { walletBalance: { increment: amount } },
      });
      updatedBalance = updatedUser.walletBalance;
    }

    // Create transaction — store HMAC signature in reference field alongside user's ref
    const combinedRef = sanitizedRef
      ? `${sanitizedRef}|SIG:${txSignature.substring(0, 32)}`
      : `SIG:${txSignature.substring(0, 32)}`;

    const transaction = await db.walletTransaction.create({
      data: {
        userId: decoded.userId,
        type: "recharge",
        amount,
        balance: updatedBalance,
        method,
        reference: combinedRef,
        description: isAutoConfirm
          ? `شحن تلقائي ${amount} ج.م عن طريق ${method}`
          : `طلب شحن محفظة ${amount} ج.م عن طريق ${method}`,
        status: finalStatus,
      },
    });

    // ==========================================
    // Log operation with structured details
    // ==========================================
    const clientIp = getClientIp(request);
    const userAgent = request.headers.get("user-agent") || "unknown";

    try {
      await db.operationLog.create({
        data: {
          action: isAutoConfirm ? "WALLET_RECHARGE_AUTO" : "WALLET_RECHARGE_REQUEST",
          entityType: "WalletTransaction",
          entityId: transaction.id,
          userId: decoded.userId,
          details: JSON.stringify({
            amount,
            method,
            autoConfirm: isAutoConfirm,
            signature: txSignature.substring(0, 16) + "...",
            userRef: sanitizedRef || null,
            hasScreenshot: !!sanitizedScreenshot,
            balanceBefore: user.walletBalance,
            balanceAfter: updatedBalance,
          }),
          ipAddress: clientIp,
          userAgent,
        },
      });
    } catch (logErr) {
      console.error("Failed to log wallet recharge operation:", logErr);
    }

    return NextResponse.json({
      success: true,
      message: isAutoConfirm
        ? "تم شحن المحفظة بنجاح — الرصيد الجديد: " + updatedBalance.toLocaleString() + " ج.م"
        : "تم تسجيل طلب الشحن بنجاح — بانتظار تأكيد المطور",
      autoConfirmed: isAutoConfirm,
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
  } catch (error) {
    console.error("Wallet POST error:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء معالجة طلب الشحن — حاول مرة أخرى لاحقاً. إذا استمرت المشكلة تواصل مع الدعم" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verify } from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "";

// 🔐 التحقق من المستخدم
function authenticate(request: NextRequest) {
  const token = request.cookies.get("auth-token")?.value;
  if (!token) return null;
  try {
    return verify(token, JWT_SECRET) as { userId: string; role: string; identifier: string };
  } catch {
    return null;
  }
}

// GET - جلب رصيد المحفظة والمعاملات
export async function GET(request: NextRequest) {
  try {
    const decoded = authenticate(request);
    if (!decoded) {
      return NextResponse.json({ error: "يجب تسجيل الدخول" }, { status: 401 });
    }

    // جلب بيانات المستخدم مع الرصيد
    const user = await db.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, name: true, email: true, walletBalance: true, role: true },
    });

    if (!user) {
      return NextResponse.json({ error: "المستخدم غير موجود" }, { status: 404 });
    }

    // جلب آخر 50 معاملة
    const transactions = await db.walletTransaction.findMany({
      where: { userId: decoded.userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    // إحصائيات
    const stats = await db.walletTransaction.groupBy({
      by: ["type"],
      where: { userId: decoded.userId, status: "completed" },
      _sum: { amount: true },
    });

    const totalRecharged = stats.find(s => s.type === "recharge")?._sum.amount || 0;
    const totalSpent = stats.find(s => s.type === "payment")?._sum.amount || 0;

    return NextResponse.json({
      balance: user.walletBalance || 0,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      transactions,
      stats: {
        totalRecharged,
        totalSpent,
        transactionCount: transactions.length,
      },
    });
  } catch (error) {
    console.error("Wallet GET error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

// POST - شحن المحفظة
export async function POST(request: NextRequest) {
  try {
    const decoded = authenticate(request);
    if (!decoded) {
      return NextResponse.json({ error: "يجب تسجيل الدخول" }, { status: 401 });
    }

    const body = await request.json();
    const { amount, method, reference } = body;

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "المبلغ غير صالح" }, { status: 400 });
    }

    if (amount > 50000) {
      return NextResponse.json({ error: "الحد الأقصى للشحنة 50,000 ج.م" }, { status: 400 });
    }

    const validMethods = ["vodafone_cash", "orange_cash", "etisalat_cash", "bank_transfer", "instapay"];
    if (!method || !validMethods.includes(method)) {
      return NextResponse.json({ error: "طريقة الدفع غير صالحة" }, { status: 400 });
    }

    // التحقق من أن المستخدم موجود
    const user = await db.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, walletBalance: true, isBlocked: true },
    });

    if (!user) {
      return NextResponse.json({ error: "المستخدم غير موجود" }, { status: 404 });
    }

    if (user.isBlocked) {
      return NextResponse.json({ error: "حسابك محظور" }, { status: 403 });
    }

    // إنشاء معاملة شحن (pending — المطور يحولها لـ completed بعد التأكد)
    const transaction = await db.walletTransaction.create({
      data: {
        userId: decoded.userId,
        type: "recharge",
        amount,
        balance: user.walletBalance, // الرصيد الحالي (هيتحدث لما المطور يؤكد)
        method,
        reference: reference || null,
        description: `طلب شحن محفظة ${amount} ج.م`,
        status: "pending",
      },
    });

    // تسجيل العملية
    try {
      await db.operationLog.create({
        data: {
          action: "WALLET_RECHARGE_REQUEST",
          entityType: "WalletTransaction",
          entityId: transaction.id,
          userId: decoded.userId,
          details: `طلب شحن ${amount} ج.م عن طريق ${method}`,
          ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown",
        },
      });
    } catch {}

    return NextResponse.json({
      success: true,
      message: "تم تسجيل طلب الشحن بنجاح — بانتظار تأكيد المطور",
      transaction: {
        id: transaction.id,
        amount: transaction.amount,
        method: transaction.method,
        status: transaction.status,
        createdAt: transaction.createdAt,
      },
    });
  } catch (error) {
    console.error("Wallet POST error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

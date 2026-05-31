import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verify } from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "";
const DEVELOPER_EMAIL = process.env.DEVELOPER_EMAIL || "";

// 🔐 التحقق من المطور
async function isDeveloper(request: NextRequest): Promise<{ userId: string } | null> {
  const token = request.cookies.get("auth-token")?.value;
  if (!token) return null;
  try {
    const decoded = verify(token, JWT_SECRET) as { userId: string; role?: string; identifier?: string };
    if (decoded.role === "DEVELOPER" || decoded.identifier === DEVELOPER_EMAIL) {
      return decoded;
    }
    return null;
  } catch {
    return null;
  }
}

// GET - جلب كل طلبات الشحن المعلقة (للمطور)
export async function GET(request: NextRequest) {
  try {
    const dev = await isDeveloper(request);
    if (!dev) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "pending";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    const where = status === "all" ? {} : { status };

    const [transactions, total] = await Promise.all([
      db.walletTransaction.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true, phone: true, identifier: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.walletTransaction.count({ where }),
    ]);

    return NextResponse.json({
      transactions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Wallet transactions GET error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

// PUT - تأكيد أو رفض معاملة شحن (للمطور)
export async function PUT(request: NextRequest) {
  try {
    const dev = await isDeveloper(request);
    if (!dev) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const { id } = await request.json();
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action"); // confirm | reject | refund | adjust

    if (!id || !action) {
      return NextResponse.json({ error: "بيانات مطلوبة" }, { status: 400 });
    }

    const transaction = await db.walletTransaction.findUnique({
      where: { id },
    });

    if (!transaction) {
      return NextResponse.json({ error: "المعاملة غير موجودة" }, { status: 404 });
    }

    if (action === "confirm" && transaction.status === "pending" && transaction.type === "recharge") {
      // تأكيد الشحنة — زيادة رصيد المستخدم
      const updatedUser = await db.user.update({
        where: { id: transaction.userId },
        data: { walletBalance: { increment: transaction.amount } },
      });

      await db.walletTransaction.update({
        where: { id },
        data: {
          status: "completed",
          balance: updatedUser.walletBalance,
          description: `تم شحن ${transaction.amount} ج.م بنجاح ✅`,
        },
      });

      // تسجيل
      try {
        await db.operationLog.create({
          data: {
            action: "WALLET_RECHARGE_CONFIRMED",
            entityType: "WalletTransaction",
            entityId: id,
            userId: dev.userId,
            details: `تأكيد شحن ${transaction.amount} ج.م للمستخدم ${transaction.userId}`,
          },
        });
      } catch {}

      return NextResponse.json({ success: true, message: "تم تأكيد الشحن بنجاح ✅" });

    } else if (action === "reject" && transaction.status === "pending") {
      await db.walletTransaction.update({
        where: { id },
        data: { status: "failed", description: "تم رفض طلب الشحن" },
      });

      return NextResponse.json({ success: true, message: "تم رفض طلب الشحن" });

    } else if (action === "refund") {
      // استرداد مبلغ — إضافة للرصيد
      const updatedUser = await db.user.update({
        where: { id: transaction.userId },
        data: { walletBalance: { increment: transaction.amount } },
      });

      // إنشاء معاملة استرداد
      await db.walletTransaction.create({
        data: {
          userId: transaction.userId,
          type: "refund",
          amount: transaction.amount,
          balance: updatedUser.walletBalance,
          description: `استرداد مبلغ ${transaction.amount} ج.م`,
          status: "completed",
        },
      });

      return NextResponse.json({ success: true, message: "تم استرداد المبلغ بنجاح" });

    } else {
      return NextResponse.json({ error: "إجراء غير صالح" }, { status: 400 });
    }
  } catch (error) {
    console.error("Wallet PUT error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

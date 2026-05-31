import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verify } from "jsonwebtoken";
import { JWT_SECRET } from "@/lib/auth";
import { getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const DEVELOPER_EMAIL = process.env.DEVELOPER_EMAIL;

// ==========================================
// Enhanced Developer Authentication with PIN verification
// ==========================================
async function isDeveloper(request: NextRequest): Promise<{ userId: string; identifier?: string } | null> {
  const token = request.cookies.get("auth-token")?.value;
  if (!token) return null;
  try {
    const decoded = verify(token, JWT_SECRET, { algorithms: ["HS256"] }) as unknown as {
      userId: string;
      role?: string;
      identifier?: string;
    };
    if (decoded.role === "DEVELOPER" || (DEVELOPER_EMAIL && decoded.identifier === DEVELOPER_EMAIL)) {
      return decoded;
    }
    return null;
  } catch {
    return null;
  }
}

// ==========================================
// Structured Logging Helper
// Creates a JSON-serializable log detail object
// ==========================================
function structuredLogData(action: string, data: Record<string, unknown>): string {
  return JSON.stringify({
    action,
    timestamp: new Date().toISOString(),
    ...data,
  });
}

// ==========================================
// GET — جلب كل طلبات الشحن (للمطور) مع فلترة متقدمة
// Enhanced: supports userId filter + user transaction history
// ==========================================
export async function GET(request: NextRequest) {
  try {
    const dev = await isDeveloper(request);
    if (!dev) {
      return NextResponse.json({ error: "غير مصرح — يتطلب صلاحيات المطور" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "pending";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20") || 20));
    const method = searchParams.get("method") || "all";
    const search = searchParams.get("search") || "";
    const targetUserId = searchParams.get("userId") || "";
    const includeUserHistory = searchParams.get("includeUserHistory") === "true";

    const where: Record<string, unknown> = {};

    if (status !== "all") where.status = status;
    if (method !== "all") where.method = method;

    // Filter by specific user
    if (targetUserId) {
      where.userId = targetUserId;
    }

    // Search by user name or reference
    if (search) {
      where.OR = [
        { reference: { contains: search } },
        { user: { name: { contains: search } } },
        { user: { identifier: { contains: search } } },
      ];
    }

    const [transactions, total] = await Promise.all([
      db.walletTransaction.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              identifier: true,
              isBlocked: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.walletTransaction.count({ where }),
    ]);

    // Aggregate stats
    const aggStats = await db.walletTransaction.aggregate({
      where: status !== "all" ? { status } : {},
      _sum: { amount: true },
      _count: true,
    });

    // Bonus: Include user's full transaction history when requested
    let userHistory: Record<string, unknown> | null = null;
    if (targetUserId && includeUserHistory) {
      const userExists = await db.user.findUnique({
        where: { id: targetUserId },
        select: { id: true, name: true, walletBalance: true },
      });

      if (userExists) {
        const history = await db.walletTransaction.findMany({
          where: { userId: targetUserId },
          orderBy: { createdAt: "desc" },
          take: 50,
        });

        const historyStats = await db.walletTransaction.groupBy({
          by: ["type"],
          where: { userId: targetUserId, status: "completed" },
          _sum: { amount: true },
          _count: true,
        });

        userHistory = {
          user: userExists,
          transactions: history,
          summary: {
            currentBalance: userExists.walletBalance,
            byType: historyStats.map((s) => ({
              type: s.type,
              totalAmount: s._sum.amount || 0,
              count: s._count,
            })),
          },
        };
      }
    }

    // Structured access log
    try {
      await db.operationLog.create({
        data: {
          action: "WALLET_TRANSACTIONS_LISTED",
          entityType: "WalletTransaction",
          userId: dev.userId,
          details: structuredLogData("LIST", {
            filters: { status, method, search: search || null, userId: targetUserId || null },
            pagination: { page, limit },
            resultCount: total,
          }),
          ipAddress: getClientIp(request),
          userAgent: request.headers.get("user-agent") || "unknown",
        },
      });
    } catch {}

    return NextResponse.json({
      transactions,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      stats: {
        totalAmount: aggStats._sum.amount || 0,
        totalCount: aggStats._count,
      },
      userHistory,
    });
  } catch (error) {
    console.error("Wallet transactions GET error:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء جلب المعاملات — حاول مرة أخرى" },
      { status: 500 }
    );
  }
}

// ==========================================
// PUT — تأكيد / رفض / استرداد معاملة (للمطور)
// Enhanced: bulk actions + structured logging
// ==========================================
export async function PUT(request: NextRequest) {
  try {
    const dev = await isDeveloper(request);
    if (!dev) {
      return NextResponse.json({ error: "غير مصرح — يتطلب صلاحيات المطور" }, { status: 403 });
    }

    const body = await request.json();
    const { id, action, note, securityPin, ids, bulkAction } = body;

    const clientIp = getClientIp(request);
    const userAgent = request.headers.get("user-agent") || "unknown";

    // ==========================================
    // BULK ACTIONS — Confirm or Reject Multiple
    // ==========================================
    if (bulkAction && ids && Array.isArray(ids) && ids.length > 0) {
      if (ids.length > 50) {
        return NextResponse.json(
          { error: "الحد الأقصى 50 معاملة في العملية الواحدة" },
          { status: 400 }
        );
      }

      // Verify security PIN if set in settings (mandatory when configured)
      const settings = await db.settings.findFirst({ orderBy: { createdAt: "desc" } });
      if ((settings as unknown as Record<string, unknown>)?.paymentSecurityPin) {
        if (!securityPin || securityPin !== (settings as unknown as Record<string, unknown>).paymentSecurityPin) {
          await db.operationLog.create({
            data: {
              action: "WALLET_BULK_PIN_FAILED",
              entityType: "WalletTransaction",
              userId: dev.userId,
              details: structuredLogData("BULK_PIN_FAIL", {
                bulkAction,
                idsCount: ids.length,
                ids: ids,
              }),
              ipAddress: clientIp,
              userAgent,
            },
          });
          return NextResponse.json({ error: "رمز الأمان مطلوب. يرجى إدخال رمز الأمان" }, { status: 403 });
        }
      }

      if (bulkAction === "bulk_confirm") {
        return handleBulkConfirm(ids, dev.userId, note, clientIp, userAgent);
      }

      if (bulkAction === "bulk_reject") {
        return handleBulkReject(ids, dev.userId, note, clientIp, userAgent);
      }

      return NextResponse.json(
        { error: `إجراء bulk غير صالح: "${bulkAction}" — استخدم bulk_confirm أو bulk_reject` },
        { status: 400 }
      );
    }

    // ==========================================
    // SINGLE ACTION
    // ==========================================
    if (!id || !action) {
      return NextResponse.json(
        { error: "بيانات مطلوبة — حدد id و action" },
        { status: 400 }
      );
    }

    // Verify security PIN if set in settings (mandatory when configured)
    const settings = await db.settings.findFirst({ orderBy: { createdAt: "desc" } });
    if ((settings as unknown as Record<string, unknown>)?.paymentSecurityPin) {
      if (!securityPin || securityPin !== (settings as unknown as Record<string, unknown>).paymentSecurityPin) {
        await db.operationLog.create({
          data: {
            action: "WALLET_PIN_FAILED",
            entityType: "WalletTransaction",
            entityId: id,
            userId: dev.userId,
            details: structuredLogData("PIN_FAIL", {
              action,
              transactionId: id,
            }),
            ipAddress: clientIp,
            userAgent,
          },
        });
        return NextResponse.json({ error: "رمز الأمان مطلوب. يرجى إدخال رمز الأمان" }, { status: 403 });
      }
    }

    const transaction = await db.walletTransaction.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, isBlocked: true, walletBalance: true } },
      },
    });

    if (!transaction) {
      return NextResponse.json({ error: "المعاملة غير موجودة — تأكد من رقم المعاملة" }, { status: 404 });
    }

    const sanitizedNote = (note || "").replace(/<[^>]*>/g, "").trim().slice(0, 200);

    // ==========================================
    // CONFIRM
    // ==========================================
    if (action === "confirm" && transaction.status === "pending" && transaction.type === "recharge") {
      const updatedUser = await db.user.update({
        where: { id: transaction.userId },
        data: { walletBalance: { increment: transaction.amount } },
      });

      await db.walletTransaction.update({
        where: { id },
        data: {
          status: "completed",
          balance: updatedUser.walletBalance,
          description: sanitizedNote
            ? `تم شحن ${transaction.amount} ج.م — ${sanitizedNote}`
            : `تم شحن ${transaction.amount} ج.م بنجاح`,
        },
      });

      try {
        await db.operationLog.create({
          data: {
            action: "WALLET_RECHARGE_CONFIRMED",
            entityType: "WalletTransaction",
            entityId: id,
            userId: dev.userId,
            details: structuredLogData("CONFIRM", {
              amount: transaction.amount,
              method: transaction.method,
              targetUserId: transaction.userId,
              targetUserName: transaction.user?.name,
              balanceBefore: transaction.user?.walletBalance,
              balanceAfter: updatedUser.walletBalance,
              note: sanitizedNote || null,
            }),
            ipAddress: clientIp,
            userAgent,
          },
        });
      } catch {}

      return NextResponse.json({
        success: true,
        message: `تم تأكيد الشحن بنجاح — رصيد المستخدم الآن ${updatedUser.walletBalance.toLocaleString()} ج.م`,
      });
    }

    // ==========================================
    // REJECT
    // ==========================================
    else if (action === "reject" && transaction.status === "pending") {
      await db.walletTransaction.update({
        where: { id },
        data: {
          status: "failed",
          description: sanitizedNote
            ? `تم رفض طلب الشحن — ${sanitizedNote}`
            : "تم رفض طلب الشحن",
        },
      });

      try {
        await db.operationLog.create({
          data: {
            action: "WALLET_RECHARGE_REJECTED",
            entityType: "WalletTransaction",
            entityId: id,
            userId: dev.userId,
            details: structuredLogData("REJECT", {
              amount: transaction.amount,
              method: transaction.method,
              targetUserId: transaction.userId,
              targetUserName: transaction.user?.name,
              note: sanitizedNote || null,
            }),
            ipAddress: clientIp,
            userAgent,
          },
        });
      } catch {}

      return NextResponse.json({ success: true, message: "تم رفض طلب الشحن" });
    }

    // ==========================================
    // REFUND
    // ==========================================
    else if (action === "refund") {
      const existingRefund = await db.walletTransaction.findFirst({
        where: {
          userId: transaction.userId,
          type: "refund",
          status: "completed",
          reference: `REFUND-${transaction.id}`,
        },
      });

      if (existingRefund) {
        return NextResponse.json(
          { error: "تم استرداد هذا المبلغ مسبقاً — لا يمكن الاسترداد مرة أخرى" },
          { status: 400 }
        );
      }

      const updatedUser = await db.user.update({
        where: { id: transaction.userId },
        data: { walletBalance: { increment: transaction.amount } },
      });

      await db.walletTransaction.create({
        data: {
          userId: transaction.userId,
          type: "refund",
          amount: transaction.amount,
          balance: updatedUser.walletBalance,
          description: sanitizedNote
            ? `استرداد مبلغ ${transaction.amount} ج.م — ${sanitizedNote}`
            : `استرداد مبلغ ${transaction.amount} ج.م`,
          reference: `REFUND-${transaction.id}`,
          status: "completed",
          method: transaction.method,
        },
      });

      try {
        await db.operationLog.create({
          data: {
            action: "WALLET_REFUND_ISSUED",
            entityType: "WalletTransaction",
            entityId: id,
            userId: dev.userId,
            details: structuredLogData("REFUND", {
              originalAmount: transaction.amount,
              originalMethod: transaction.method,
              originalTxId: id,
              targetUserId: transaction.userId,
              targetUserName: transaction.user?.name,
              balanceBefore: transaction.user?.walletBalance,
              balanceAfter: updatedUser.walletBalance,
              note: sanitizedNote || null,
            }),
            ipAddress: clientIp,
            userAgent,
          },
        });
      } catch {}

      return NextResponse.json({ success: true, message: "تم استرداد المبلغ بنجاح" });
    }

    // ==========================================
    // ADJUST
    // ==========================================
    else if (action === "adjust") {
      const { adjustAmount } = body;
      if (adjustAmount === undefined || adjustAmount === null || typeof adjustAmount !== "number") {
        return NextResponse.json(
          { error: "مبلغ التعديل مطلوب ويجب أن يكون رقماً" },
          { status: 400 }
        );
      }

      const updatedUser = await db.user.update({
        where: { id: transaction.userId },
        data: { walletBalance: { increment: adjustAmount } },
      });

      const adjustTx = await db.walletTransaction.create({
        data: {
          userId: transaction.userId,
          type: "admin_adjustment",
          amount: adjustAmount,
          balance: updatedUser.walletBalance,
          description: sanitizedNote
            ? `تعديل يدوي ${adjustAmount > 0 ? "+" : ""}${adjustAmount} ج.م — ${sanitizedNote}`
            : `تعديل يدوي ${adjustAmount > 0 ? "+" : ""}${adjustAmount} ج.م`,
          status: "completed",
        },
      });

      try {
        await db.operationLog.create({
          data: {
            action: "WALLET_ADMIN_ADJUSTMENT",
            entityType: "WalletTransaction",
            entityId: transaction.userId,
            userId: dev.userId,
            details: structuredLogData("ADJUST", {
              adjustAmount,
              targetUserId: transaction.userId,
              targetUserName: transaction.user?.name,
              balanceBefore: transaction.user?.walletBalance,
              balanceAfter: updatedUser.walletBalance,
              newTxId: adjustTx.id,
              note: sanitizedNote || null,
            }),
            ipAddress: clientIp,
            userAgent,
          },
        });
      } catch {}

      return NextResponse.json({
        success: true,
        message: `تم تعديل الرصيد بنجاح — الرصيد الجديد: ${updatedUser.walletBalance.toLocaleString()} ج.م`,
      });
    }

    // ==========================================
    // Invalid Action
    // ==========================================
    else {
      return NextResponse.json(
        {
          error: "إجراء غير صالح — الإجراءات المتاحة: confirm, reject, refund, adjust",
          hint: {
            confirm: "للتأكيد — يجب أن تكون المعاملة pending من نوع recharge",
            reject: "للرفض — يجب أن تكون المعاملة pending",
            refund: "للاسترداد — لا يمكن استرداد معاملة مرتدعة مسبقاً",
            adjust: "للتعديل اليدوي — يتطلب adjustAmount (رقم)",
          },
        },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Wallet PUT error:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء معالجة المعاملة — حاول مرة أخرى" },
      { status: 500 }
    );
  }
}

// ==========================================
// Bulk Confirm Handler
// ==========================================
async function handleBulkConfirm(
  ids: string[],
  devUserId: string,
  note: string,
  clientIp: string,
  userAgent: string
) {
  const sanitizedNote = (note || "").replace(/<[^>]*>/g, "").trim().slice(0, 200);

  // Fetch all pending recharge transactions for these IDs
  const transactions = await db.walletTransaction.findMany({
    where: {
      id: { in: ids },
      status: "pending",
      type: "recharge",
    },
    include: {
      user: { select: { id: true, name: true, walletBalance: true, isBlocked: true } },
    },
  });

  if (transactions.length === 0) {
    return NextResponse.json(
      { error: "لا توجد معاملات معلقة للتأكيد — تأكد من حالة المعاملات" },
      { status: 400 }
    );
  }

  let confirmedCount = 0;
  let skippedCount = 0;
  const errors: Array<{ id: string; reason: string }> = [];
  const results: Array<{ id: string; success: boolean; newBalance: number }> = [];

  for (const tx of transactions) {
    if (tx.user?.isBlocked) {
      errors.push({ id: tx.id, reason: "حساب المستخدم محظور" });
      skippedCount++;
      continue;
    }

    try {
      const updatedUser = await db.user.update({
        where: { id: tx.userId },
        data: { walletBalance: { increment: tx.amount } },
      });

      await db.walletTransaction.update({
        where: { id: tx.id },
        data: {
          status: "completed",
          balance: updatedUser.walletBalance,
          description: sanitizedNote
            ? `شحن ${tx.amount} ج.م — ${sanitizedNote} (تأكيد جماعي)`
            : `شحن ${tx.amount} ج.م (تأكيد جماعي)`,
        },
      });

      results.push({ id: tx.id, success: true, newBalance: updatedUser.walletBalance });
      confirmedCount++;
    } catch (err) {
      errors.push({ id: tx.id, reason: "فشل في التحديث" });
      skippedCount++;
    }
  }

  // Structured log
  try {
    await db.operationLog.create({
      data: {
        action: "WALLET_BULK_CONFIRM",
        entityType: "WalletTransaction",
        userId: devUserId,
        details: structuredLogData("BULK_CONFIRM", {
          requestedIds: ids.length,
          confirmed: confirmedCount,
          skipped: skippedCount,
          errors: errors.length > 0 ? errors : undefined,
          note: sanitizedNote || null,
        }),
        ipAddress: clientIp,
        userAgent,
      },
    });
  } catch {}

  return NextResponse.json({
    success: true,
    message: `تم تأكيد ${confirmedCount} معاملة بنجاح${skippedCount > 0 ? ` — تم تخطي ${skippedCount}` : ""}`,
    confirmedCount,
    skippedCount,
    results,
    errors: errors.length > 0 ? errors : undefined,
  });
}

// ==========================================
// Bulk Reject Handler
// ==========================================
async function handleBulkReject(
  ids: string[],
  devUserId: string,
  note: string,
  clientIp: string,
  userAgent: string
) {
  const sanitizedNote = (note || "").replace(/<[^>]*>/g, "").trim().slice(0, 200);

  const transactions = await db.walletTransaction.findMany({
    where: {
      id: { in: ids },
      status: "pending",
    },
    include: {
      user: { select: { id: true, name: true } },
    },
  });

  if (transactions.length === 0) {
    return NextResponse.json(
      { error: "لا توجد معاملات معلقة للرفض — تأكد من حالة المعاملات" },
      { status: 400 }
    );
  }

  let rejectedCount = 0;
  let skippedCount = 0;

  for (const tx of transactions) {
    try {
      await db.walletTransaction.update({
        where: { id: tx.id },
        data: {
          status: "failed",
          description: sanitizedNote
            ? `تم رفض طلب الشحن — ${sanitizedNote} (رفض جماعي)`
            : "تم رفض طلب الشحن (رفض جماعي)",
        },
      });
      rejectedCount++;
    } catch {
      skippedCount++;
    }
  }

  // Structured log
  try {
    await db.operationLog.create({
      data: {
        action: "WALLET_BULK_REJECT",
        entityType: "WalletTransaction",
        userId: devUserId,
        details: structuredLogData("BULK_REJECT", {
          requestedIds: ids.length,
          rejected: rejectedCount,
          skipped: skippedCount,
          note: sanitizedNote || null,
        }),
        ipAddress: clientIp,
        userAgent,
      },
    });
  } catch {}

  return NextResponse.json({
    success: true,
    message: `تم رفض ${rejectedCount} معاملة بنجاح${skippedCount > 0 ? ` — تم تخطي ${skippedCount}` : ""}`,
    rejectedCount,
    skippedCount,
  });
}

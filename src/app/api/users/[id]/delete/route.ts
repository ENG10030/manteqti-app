import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

interface DeleteOptions {
  deleteApartments: boolean;
  deleteMessages: boolean;
  deletePayments: boolean;
  deleteInquiries: boolean;
  deleteAccount: boolean;
}

// حذف مستخدم (المطور فقط) — مع خيارات اختيارية
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser(request);

    if (!currentUser || currentUser.role !== "DEVELOPER") {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const { id: userId } = await params;

    const targetUser = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, role: true, identifier: true },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "المستخدم غير موجود" }, { status: 404 });
    }

    if (targetUser.role === "DEVELOPER") {
      return NextResponse.json({ error: "لا يمكن حذف حساب المطور" }, { status: 400 });
    }

    // Parse options from body
    let body: { options?: DeleteOptions } = {};
    try {
      body = await request.json();
    } catch {}

    const options: DeleteOptions = body.options || {
      deleteApartments: true,
      deleteMessages: true,
      deletePayments: true,
      deleteInquiries: true,
      deleteAccount: true,
    };

    // If deleteAccount is true, delete everything (original behavior)
    if (options.deleteAccount) {
      const userStats = {
        apartments: await db.apartment.count({ where: { createdBy: userId } }),
        inquiries: await db.inquiry.count({ where: { userId } }),
        payments: await db.payment.count({ where: { userId } }),
        messages: await db.message.count({ where: { senderId: userId } }),
      };

      await db.user.delete({ where: { id: userId } });

      try {
        await db.operationLog.create({
          data: {
            action: "DELETE_USER",
            entityType: "User",
            entityId: userId,
            details: JSON.stringify({
              userName: targetUser.name,
              identifier: targetUser.identifier,
              stats: userStats,
              options: 'all',
            }),
            userId: currentUser.id,
          },
        });
      } catch {}

      return NextResponse.json({
        success: true,
        message: `تم حذف المستخدم "${targetUser.name}" وجميع بياناته`,
      });
    }

    // Partial deletion — delete only selected items
    const deletedItems: string[] = [];

    try {
      // Delete apartments
      if (options.deleteApartments) {
        const count = await db.apartment.count({ where: { createdBy: userId } });
        if (count > 0) {
          await db.apartment.deleteMany({ where: { createdBy: userId } });
          deletedItems.push(`${count} عقار`);
        }
      }

      // Delete inquiries (as creator)
      if (options.deleteInquiries) {
        const count = await db.inquiry.count({ where: { userId } });
        if (count > 0) {
          await db.inquiry.deleteMany({ where: { userId } });
          deletedItems.push(`${count} استفسار`);
        }
      }

      // Delete payments
      if (options.deletePayments) {
        const count = await db.payment.count({ where: { userId } });
        if (count > 0) {
          await db.payment.deleteMany({ where: { userId } });
          deletedItems.push(`${count} دفعة`);
        }
      }

      // Delete messages (as sender or receiver)
      if (options.deleteMessages) {
        const sent = await db.message.count({ where: { senderId: userId } });
        const received = await db.message.count({ where: { receiverId: userId } });
        if (sent > 0) await db.message.deleteMany({ where: { senderId: userId } });
        if (received > 0) await db.message.deleteMany({ where: { receiverId: userId } });
        const total = sent + received;
        if (total > 0) deletedItems.push(`${total} رسالة`);
      }
    } catch (error) {
      console.error("Partial delete error:", error);
      return NextResponse.json(
        { error: "حدث خطأ أثناء حذف البيانات" },
        { status: 500 }
      );
    }

    // Log partial deletion
    try {
      await db.operationLog.create({
        data: {
          action: "DELETE_USER_DATA",
          entityType: "User",
          entityId: userId,
          details: JSON.stringify({
            userName: targetUser.name,
            identifier: targetUser.identifier,
            options,
            deletedItems,
          }),
          userId: currentUser.id,
        },
      });
    } catch {}

    const message = deletedItems.length > 0
      ? `تم حذف: ${deletedItems.join('، ')} للمستخدم "${targetUser.name}"`
      : `لم يتم حذف أي بيانات للمستخدم "${targetUser.name}"`;

    return NextResponse.json({
      success: true,
      message,
    });
  } catch (error) {
    console.error("Delete user error:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء حذف المستخدم" },
      { status: 500 }
    );
  }
}

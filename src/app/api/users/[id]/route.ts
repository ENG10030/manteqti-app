import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { db } from "@/lib/db"
import { broadcastEvent, WebhookEvents } from "@/lib/webhook"

// جلب تفاصيل المستخدم الكاملة مع كل نشاطاته (للمطور)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request)

    if (!user || user.role !== "DEVELOPER") {
      return NextResponse.json(
        { error: "غير مصرح لك بهذا الإجراء" },
        { status: 403 }
      )
    }

    const { id: userId } = await params

    const targetUser = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        identifier: true,
        role: true,
        isBlocked: true,
        blockedAt: true,
        blockReason: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
      }
    })

    if (!targetUser) {
      return NextResponse.json(
        { error: "المستخدم غير موجود" },
        { status: 404 }
      )
    }

    // جلب كل نشاطات المستخدم بالتوازي
    const [
      userApartments,
      userInquiries,
      userPayments,
      userComments,
      userLikes,
      userMessages,
      userEditRequests,
      receivedMessages,
    ] = await Promise.all([
      // عقارات المستخدم
      db.apartment.findMany({
        where: { createdBy: userId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true, title: true, price: true, area: true, type: true,
          status: true, views: true, isFeatured: true, isVip: true,
          createdAt: true,
        }
      }),

      // استفسارات المستخدم
      db.inquiry.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        include: {
          apartment: { select: { id: true, title: true, price: true } },
          payment: { select: { id: true, status: true, method: true, amount: true } },
        }
      }),

      // مدفوعات المستخدم
      db.payment.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        include: {
          inquiry: {
            select: {
              id: true, name: true, phone: true, email: true,
              apartment: { select: { id: true, title: true } },
            }
          }
        }
      }),

      // تعليقات المستخدم
      db.comment.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        include: {
          apartment: { select: { id: true, title: true } },
        }
      }),

      // إعجابات المستخدم
      db.like.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        include: {
          apartment: { select: { id: true, title: true } },
        }
      }),

      // رسائل المستخدم المرسلة
      db.message.findMany({
        where: { senderId: userId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true, content: true, isRead: true, createdAt: true,
          receiverId: true,
        }
      }),

      // طلبات تعديل المستخدم
      db.propertyEditRequest.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        include: {
          apartment: { select: { id: true, title: true, price: true, status: true } },
        }
      }),

      // الرسائل الواردة للمستخدم (رسائل المطور له)
      db.message.findMany({
        where: { receiverId: userId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true, content: true, isRead: true, createdAt: true,
          senderId: true,
        }
      }),
    ])

    // إحصائيات سريعة
    const stats = {
      totalApartments: userApartments.length,
      activeApartments: userApartments.filter(a => a.status === 'available').length,
      pendingApartments: userApartments.filter(a => a.status === 'pending').length,
      rejectedApartments: userApartments.filter(a => a.status === 'rejected').length,
      totalInquiries: userInquiries.length,
      totalPayments: userPayments.length,
      paidPayments: userPayments.filter(p => p.status === 'Paid').length,
      pendingPayments: userPayments.filter(p => p.status === 'Pending').length,
      totalPaymentAmount: userPayments.filter(p => p.status === 'Paid').reduce((sum, p) => sum + p.amount, 0),
      totalComments: userComments.length,
      pendingComments: userComments.filter(c => c.status === 'pending').length,
      totalLikes: userLikes.length,
      totalMessages: userMessages.length + receivedMessages.length,
      unreadMessages: receivedMessages.filter(m => !m.isRead).length,
      totalEditRequests: userEditRequests.length,
      pendingEditRequests: userEditRequests.filter(r => r.status === 'pending').length,
      totalViews: userApartments.reduce((sum, a) => sum + (a.views || 0), 0),
    }

    return NextResponse.json({
      user: targetUser,
      apartments: userApartments.map(a => ({ ...a, createdAt: a.createdAt.toISOString() })),
      inquiries: userInquiries.map(i => ({ ...i, createdAt: i.createdAt.toISOString() })),
      payments: userPayments.map(p => ({ ...p, createdAt: p.createdAt.toISOString() })),
      comments: userComments.map(c => ({ ...c, createdAt: c.createdAt.toISOString() })),
      likes: userLikes.map(l => ({ ...l, createdAt: l.createdAt.toISOString() })),
      messages: {
        sent: userMessages.map(m => ({ ...m, createdAt: m.createdAt.toISOString() })),
        received: receivedMessages.map(m => ({ ...m, createdAt: m.createdAt.toISOString() })),
      },
      editRequests: userEditRequests.map(r => ({ ...r, createdAt: r.createdAt.toISOString(), reviewedAt: r.reviewedAt?.toISOString() })),
      stats,
    })

  } catch (error) {
    console.error("Get user details error:", error)
    return NextResponse.json(
      { error: "حدث خطأ أثناء جلب البيانات" },
      { status: 500 }
    )
  }
}

// حذف مستخدم بالكامل مع كل بياناته
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request)

    if (!user || user.role !== "DEVELOPER") {
      return NextResponse.json(
        { error: "غير مصرح لك بهذا الإجراء" },
        { status: 403 }
      )
    }

    const { id: userId } = await params

    const targetUser = await db.user.findUnique({
      where: { id: userId }
    })

    if (!targetUser) {
      return NextResponse.json(
        { error: "المستخدم غير موجود" },
        { status: 404 }
      )
    }

    if (targetUser.role === "DEVELOPER") {
      return NextResponse.json(
        { error: "لا يمكن حذف مطور" },
        { status: 400 }
      )
    }

    // جلب البيانات للحذف المتسلسل
    const userApartments = await db.apartment.findMany({
      where: { createdBy: userId },
      select: { id: true }
    })

    const apartmentIds = userApartments.map(a => a.id)

    // حذف الكل في transaction واحد
    await db.$transaction(async (tx) => {
      // حذف التعليقات على عقارات المستخدم
      if (apartmentIds.length > 0) {
        await tx.comment.deleteMany({
          where: { apartmentId: { in: apartmentIds } }
        })

        // حذف الإعجابات على عقارات المستخدم
        await tx.like.deleteMany({
          where: { apartmentId: { in: apartmentIds } }
        })

        // حذف الاستفسارات على عقارات المستخدم
        await tx.inquiry.deleteMany({
          where: { apartmentId: { in: apartmentIds } }
        })

        // حذف طلبات التعديل
        await tx.propertyEditRequest.deleteMany({
          where: { apartmentId: { in: apartmentIds } }
        })

        // حذف العقارات نفسها
        await tx.apartment.deleteMany({
          where: { createdBy: userId }
        })
      }

      // حذف رسائل المستخدم
      await tx.message.deleteMany({
        where: { senderId: userId }
      })

      // حذف إعجابات المستخدم
      await tx.like.deleteMany({
        where: { userId }
      })

      // حذف تعليقات المستخدم
      await tx.comment.deleteMany({
        where: { userId }
      })

      // حذف مدفوعات المستخدم
      await tx.payment.deleteMany({
        where: { userId }
      })

      // حذف استفسارات المستخدم
      await tx.inquiry.deleteMany({
        where: { userId }
      })

      // حذف طلبات تعديل المستخدم
      await tx.propertyEditRequest.deleteMany({
        where: { userId }
      })

      // حذف حظر المستخدم
      await tx.blockedUser.deleteMany({
        where: { userId }
      })

      // حذف المستخدم نفسه
      await tx.user.delete({
        where: { id: userId }
      })
    })

    try { await broadcastEvent(WebhookEvents.USER_CHANGED); } catch {}

    return NextResponse.json({
      success: true,
      message: "تم حذف المستخدم وكل بياناته بنجاح"
    })

  } catch (error) {
    console.error("Delete user error:", error)
    return NextResponse.json(
      { error: "حدث خطأ أثناء حذف المستخدم" },
      { status: 500 }
    )
  }
}

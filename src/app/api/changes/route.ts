import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { verify } from "jsonwebtoken";
import { JWT_SECRET } from "@/lib/auth";

// Endpoint موحد للتحديثات الفورية
// الـ frontend بيسأل كل 15 ثانية: "في حاجة جديدة من آخر مرة؟"
// الباكند بيرجع بس أنواع التغييرات - مفيش داتا زائدة
//
// إصلاح مهم (v7):
// 1) لو mفيش since — بنرجع وقت السيرفر بس (أول مزامنة) بدل ما الواجهة تعتمد
//    على ساعة جهاز المستخدم. الفرق بين ساعة الجهاز والسيرفر كان بيخلي
//    التغييرات متتكشفش أبداً والمستخدم مضطر يعمل refresh يدوي.
// 2) في هامش أمان 3 ثواني عند المقارنة (since - 3s) — إعادة الجلب آمنة
//    ومش مكلفة، لكن تفويت تغيير مكلف.
// 3) تغطية أنواع جديدة: wallet / edit-requests / likes / comments.

interface ChangeEvent {
  type: string;
  id: string;
  action: 'created' | 'updated' | 'deleted';
  updatedAt: string;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sinceStr = searchParams.get('since');

    // تحديد المستخدم الحالي (اختياري - لبعض التغييرات)
    let userId: string | null = null;
    let userRole: string | null = null;
    try {
      const cookieStore = await cookies();
      const token = cookieStore.get('auth-token')?.value;
      if (token) {
        const decoded = verify(token, JWT_SECRET!) as unknown as { userId: string; role?: string };
        userId = decoded.userId;
        userRole = decoded.role || null;
      }
    } catch {}

    // أول مزامنة: مفيش since — نرجّع وقت السيرفر بس عشان الواجهة تظبط ساعتها عليه
    // (مفيش تغييرات هنا بالتعريف — الهدف تثبيت نقطة الزمن على ساعة السيرفر)
    if (!sinceStr) {
      return NextResponse.json(
        { changes: [], serverTime: new Date().toISOString() },
        { headers: { 'Cache-Control': 'no-store', 'Pragma': 'no-cache' } }
      );
    }

    const since = new Date(sinceStr);
    if (isNaN(since.getTime())) {
      return NextResponse.json({ error: 'Invalid since format' }, { status: 400 });
    }

    // هامش أمان 3 ثواني — أي تغيير قريب من الحد يتحسب مرتين أحسن من ما يتفوّت
    const sinceWithMargin = new Date(since.getTime() - 3000);
    const changes: ChangeEvent[] = [];

    // 1. تغييرات الإعدادات (للجميع)
    try {
      const settingsChanges = await db.settings.findFirst({
        where: { updatedAt: { gt: sinceWithMargin } },
        select: { id: true, updatedAt: true },
      });
      if (settingsChanges) {
        changes.push({ type: 'settings', id: settingsChanges.id, action: 'updated', updatedAt: settingsChanges.updatedAt.toISOString() });
      }
    } catch {}

    // 2. شقق جديدة أو معدلة أو معتمدة/مرفوضة (للجميع)
    try {
      const apartmentChanges = await db.apartment.findMany({
        where: { updatedAt: { gt: sinceWithMargin } },
        select: { id: true, updatedAt: true },
        take: 20,
      });
      for (const apt of apartmentChanges) {
        changes.push({ type: 'apartments', id: apt.id, action: 'updated', updatedAt: apt.updatedAt.toISOString() });
      }
    } catch {}

    // 3. رسائل جديدة (للمستخدم المسجل)
    if (userId) {
      try {
        const msgChanges = await db.message.findMany({
          where: {
            OR: [
              { senderId: userId, createdAt: { gt: sinceWithMargin } },
              { receiverId: userId, createdAt: { gt: sinceWithMargin } },
            ],
          },
          select: { id: true, createdAt: true },
          take: 10,
        });
        for (const msg of msgChanges) {
          changes.push({ type: 'messages', id: msg.id, action: 'updated', updatedAt: msg.createdAt.toISOString() });
        }
      } catch {}
    }

    // 4. معاملات المحفظة (لصاحب المحفظة) — شحن/خصم/موافقة شحن يظهر فوراً بدون refresh
    if (userId) {
      try {
        const walletChanges = await db.walletTransaction.findMany({
          where: { userId, updatedAt: { gt: sinceWithMargin } },
          select: { id: true, updatedAt: true },
          take: 5,
        });
        for (const tx of walletChanges) {
          changes.push({ type: 'wallet', id: tx.id, action: 'updated', updatedAt: tx.updatedAt.toISOString() });
        }
      } catch {}
    }

    const isDev = userId && (userRole === 'DEVELOPER' || userRole === 'ADMIN');

    // 5. استفسارات جديدة (للمطور)
    if (isDev) {
      try {
        const inquiryChanges = await db.inquiry.findMany({
          where: { updatedAt: { gt: sinceWithMargin } },
          select: { id: true, updatedAt: true },
          take: 10,
        });
        for (const inq of inquiryChanges) {
          changes.push({ type: 'inquiries', id: inq.id, action: 'updated', updatedAt: inq.updatedAt.toISOString() });
        }
      } catch {}
    }

    // 6. مدفوعات جديدة (للمطور)
    if (isDev) {
      try {
        const paymentChanges = await db.payment.findMany({
          where: { updatedAt: { gt: sinceWithMargin } },
          select: { id: true, updatedAt: true },
          take: 10,
        });
        for (const pay of paymentChanges) {
          changes.push({ type: 'payments', id: pay.id, action: 'updated', updatedAt: pay.updatedAt.toISOString() });
        }
      } catch {}
    }

    // 7. تغييرات المستخدم المسجل نفسه (رصيد المحفظة/الاعتماد/الحظر)
    // إصلاح v7: كان بيتفحص للمطور بس — فرصيد المستخدم العادي كان عمري ما يتحدث بدون refresh
    if (userId) {
      try {
        const selfChanges = await db.user.findMany({
          where: { id: userId, updatedAt: { gt: sinceWithMargin } },
          select: { id: true, updatedAt: true },
          take: 1,
        });
        for (const u of selfChanges) {
          changes.push({ type: 'users', id: u.id, action: 'updated', updatedAt: u.updatedAt.toISOString() });
        }
      } catch {}
    }

    // 7-ب. مستخدمين جدد أو معدلين (للمطور) — تسجيل/اعتماد/حظر أي مستخدم
    if (isDev) {
      try {
        const userChanges = await db.user.findMany({
          where: { updatedAt: { gt: sinceWithMargin } },
          select: { id: true, updatedAt: true },
          take: 10,
        });
        for (const u of userChanges) {
          changes.push({ type: 'users', id: u.id, action: 'updated', updatedAt: u.updatedAt.toISOString() });
        }
      } catch {}
    }

    // 8. طلبات تعديل العقارات (للمطور)
    if (isDev) {
      try {
        const editChanges = await db.propertyEditRequest.findMany({
          where: { updatedAt: { gt: sinceWithMargin } },
          select: { id: true, updatedAt: true },
          take: 10,
        });
        for (const er of editChanges) {
          changes.push({ type: 'edit-requests', id: er.id, action: 'updated', updatedAt: er.updatedAt.toISOString() });
        }
      } catch {}
    }

    // 9. إعجابات جديدة (للمطور — عداد المفضلة في اللوحة)
    if (isDev) {
      try {
        const likeChanges = await db.like.findMany({
          where: { createdAt: { gt: sinceWithMargin } },
          select: { id: true, createdAt: true },
          take: 10,
        });
        for (const like of likeChanges) {
          changes.push({ type: 'likes', id: like.id, action: 'created', updatedAt: like.createdAt.toISOString() });
        }
      } catch {}
    }

    // 10. تعليقات جديدة (للمطور — إدارة التعليقات في اللوحة)
    if (isDev) {
      try {
        const commentChanges = await db.comment.findMany({
          where: { createdAt: { gt: sinceWithMargin } },
          select: { id: true, createdAt: true },
          take: 10,
        });
        for (const cm of commentChanges) {
          changes.push({ type: 'comments', id: cm.id, action: 'created', updatedAt: cm.createdAt.toISOString() });
        }
      } catch {}
    }

    // لا نُرجع المعرفات الداخلية — الواجهة تستخدم النوع فقط
    const publicChanges = changes.map(({ type, action, updatedAt }) => ({ type, action, updatedAt }));

    return NextResponse.json(
      { changes: publicChanges, serverTime: new Date().toISOString() },
      { headers: { 'Cache-Control': 'no-store', 'Pragma': 'no-cache' } }
    );
  } catch (error) {
    console.error('Changes endpoint error:', error);
    return NextResponse.json({ changes: [], serverTime: new Date().toISOString() });
  }
}

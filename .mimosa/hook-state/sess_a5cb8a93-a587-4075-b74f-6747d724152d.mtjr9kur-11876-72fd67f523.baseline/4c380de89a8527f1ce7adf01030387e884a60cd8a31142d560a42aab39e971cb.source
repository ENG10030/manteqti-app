import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { verify } from "jsonwebtoken";
import { JWT_SECRET } from "@/lib/auth";

// Endpoint موحد للتحديثات الفورية
// كل 3 ثواني الـ frontend بيسأل: "في حاجة جديدة من آخر مرة؟"
// الباكند بيرجع بس التغييرات الجديدة - مفيش داتا زائدة

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

    if (!sinceStr) {
      return NextResponse.json({ error: 'since parameter required' }, { status: 400 });
    }

    const since = new Date(sinceStr);
    if (isNaN(since.getTime())) {
      return NextResponse.json({ error: 'Invalid since format' }, { status: 400 });
    }

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

    const changes: ChangeEvent[] = [];
    const sinceISO = since.toISOString();

    // 1. تغييرات الإعدادات (للجميع)
    try {
      const settingsChanges = await db.settings.findFirst({
        where: { updatedAt: { gt: since } },
        select: { id: true, updatedAt: true },
      });
      if (settingsChanges) {
        changes.push({ type: 'settings', id: settingsChanges.id, action: 'updated', updatedAt: settingsChanges.updatedAt.toISOString() });
      }
    } catch {}

    // 2. شقق جديدة أو معدلة (للجميع)
    try {
      const apartmentChanges = await db.apartment.findMany({
        where: { updatedAt: { gt: since } },
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
              { senderId: userId, createdAt: { gt: since } },
              { receiverId: userId, createdAt: { gt: since } },
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

    // 4. استفسارات جديدة (للمطور)
    if (userId && (userRole === 'DEVELOPER' || userRole === 'ADMIN')) {
      try {
        const inquiryChanges = await db.inquiry.findMany({
          where: { updatedAt: { gt: since } },
          select: { id: true, updatedAt: true },
          take: 10,
        });
        for (const inq of inquiryChanges) {
          changes.push({ type: 'inquiries', id: inq.id, action: 'updated', updatedAt: inq.updatedAt.toISOString() });
        }
      } catch {}
    }

    // 5. مدفوعات جديدة (للمطور)
    if (userId && (userRole === 'DEVELOPER' || userRole === 'ADMIN')) {
      try {
        const paymentChanges = await db.payment.findMany({
          where: { updatedAt: { gt: since } },
          select: { id: true, updatedAt: true },
          take: 10,
        });
        for (const pay of paymentChanges) {
          changes.push({ type: 'payments', id: pay.id, action: 'updated', updatedAt: pay.updatedAt.toISOString() });
        }
      } catch {}
    }

    // 6. مستخدمين جدد (للمطور)
    if (userId && (userRole === 'DEVELOPER' || userRole === 'ADMIN')) {
      try {
        const userChanges = await db.user.findMany({
          where: { updatedAt: { gt: since } },
          select: { id: true, updatedAt: true },
          take: 10,
        });
        for (const u of userChanges) {
          changes.push({ type: 'users', id: u.id, action: 'updated', updatedAt: u.updatedAt.toISOString() });
        }
      } catch {}
    }

    return NextResponse.json(
      { changes, serverTime: new Date().toISOString() },
      { headers: { 'Cache-Control': 'no-store', 'Pragma': 'no-cache' } }
    );
  } catch (error) {
    console.error('Changes endpoint error:', error);
    return NextResponse.json({ changes: [], serverTime: new Date().toISOString() });
  }
}

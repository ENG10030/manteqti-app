import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';
import { verify } from 'jsonwebtoken';
import { JWT_SECRET } from '@/lib/auth';

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });
    }
    let decoded: any;
    try {
      decoded = verify(token, JWT_SECRET, { algorithms: ["HS256"] });
    } catch {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }

    // CRITICAL FIX: Check developer from DB, not just JWT
    if (decoded.role !== 'DEVELOPER') {
      const dbUser = await db.user.findUnique({ where: { id: decoded.userId }, select: { role: true } });
      if (!dbUser || dbUser.role !== 'DEVELOPER') {
        return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
      }
    }

    const inquiries = await db.inquiry.findMany({
      orderBy: { createdAt: 'desc' },
      include: { apartment: true, payment: true }
    });

    return NextResponse.json(inquiries.map(inq => ({
      id: inq.id, apartmentId: inq.apartmentId, userId: inq.userId,
      name: inq.name, email: inq.email, phone: inq.phone, message: inq.message,
      lifecycleStatus: inq.lifecycleStatus, createdAt: inq.createdAt.toISOString(),
      apartment: inq.apartment ? { id: inq.apartment.id, title: inq.apartment.title, price: inq.apartment.price, type: inq.apartment.type, status: inq.apartment.status } : null,
      payment: inq.payment ? { id: inq.payment.id, status: inq.payment.status, method: inq.payment.method } : null
    })));
  } catch (error) {
    console.error('Error fetching inquiries:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء جلب الاستفسارات' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting removed (module not available)

    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });
    }
    let decoded: any;
    try {
      decoded = verify(token, JWT_SECRET, { algorithms: ["HS256"] });
    } catch {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }

    // CRITICAL FIX: Check isBlocked from DB, not from stale JWT
    const dbUser = await db.user.findUnique({
      where: { id: decoded.userId },
      select: { isBlocked: true, emailVerified: true, isApproved: true, role: true }
    });
    if (!dbUser) {
      return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 401 });
    }
    if (dbUser.isBlocked) {
      return NextResponse.json({ error: 'حسابك محظور' }, { status: 403 });
    }
    if (!dbUser.emailVerified && dbUser.role !== 'DEVELOPER') {
      return NextResponse.json({ error: 'يجب تأكيد البريد الإلكتروني أولاً' }, { status: 403 });
    }
    if (!dbUser.isApproved && dbUser.role !== 'DEVELOPER') {
      return NextResponse.json({ error: 'حسابك بانتظار موافقة الإدارة' }, { status: 403 });
    }

    const data = await request.json();

    const inquiry = await db.inquiry.create({
      data: {
        apartmentId: data.apartmentId,
        userId: decoded.userId,
        name: data.name, email: data.email, phone: data.phone,
        message: data.message, lifecycleStatus: 'New'
      },
      include: { apartment: true }
    });

    return NextResponse.json({
      id: inquiry.id, apartmentId: inquiry.apartmentId, userId: inquiry.userId,
      name: inquiry.name, email: inquiry.email, phone: inquiry.phone,
      message: inquiry.message, lifecycleStatus: inquiry.lifecycleStatus,
      createdAt: inquiry.createdAt.toISOString()
    });
  } catch (error) {
    console.error('Error creating inquiry:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء إنشاء الاستفسار' }, { status: 500 });
  }
}

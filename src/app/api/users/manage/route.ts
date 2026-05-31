import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';
import { verify } from 'jsonwebtoken';
import { JWT_SECRET } from '@/lib/auth';

export const dynamic = "force-dynamic";

function sanitizeString(str: unknown): string {
  if (typeof str !== 'string') return '';
  return str.replace(/[<>&"']/g, '').trim().slice(0, 500);
}

// Comprehensive user management (developer only)
export async function POST(request: NextRequest) {
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

    if (decoded.role !== 'DEVELOPER') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    }

    const body = await request.json();
    const { userId, action, reason } = body;

    if (!userId || !action) {
      return NextResponse.json({ error: 'بيانات مطلوبة ناقصة' }, { status: 400 });
    }

    const targetUser = await db.user.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 });
    }

    if (targetUser.role === 'DEVELOPER') {
      return NextResponse.json({ error: 'لا يمكن تنفيذ هذا الإجراء على مطور' }, { status: 400 });
    }

    switch (action) {
      case 'block': {
        const sanitizedReason = sanitizeString(reason) || 'تم الحظر من قبل الإدارة';
        await db.user.update({
          where: { id: userId },
          data: { isBlocked: true, blockedAt: new Date(), blockReason: sanitizedReason },
        });
        await db.apartment.updateMany({ where: { createdBy: userId }, data: { status: 'hidden' } });
        await db.message.deleteMany({ where: { senderId: userId } });
        return NextResponse.json({ success: true, message: 'تم حظر المستخدم وإخفاء عقاراته' });
      }

      case 'unblock': {
        await db.user.update({
          where: { id: userId },
          data: { isBlocked: false, blockedAt: null, blockReason: null },
        });
        await db.apartment.updateMany({ where: { createdBy: userId, status: 'hidden' }, data: { status: 'pending' } });
        return NextResponse.json({ success: true, message: 'تم إلغاء حظر المستخدم' });
      }

      case 'revoke-contact': {
        const revoked = await db.inquiry.updateMany({ where: { userId, lifecycleStatus: 'Contacted' }, data: { lifecycleStatus: 'Revoked' } });
        await db.payment.updateMany({ where: { userId, status: 'Paid' }, data: { status: 'Refunded', inquiryStatus: 'Revoked' } });
        return NextResponse.json({ success: true, message: `تم إلغاء صلاحيات بيانات التواصل (${revoked.count} طلب)` });
      }

      case 'hide-apartments': {
        const result = await db.apartment.updateMany({ where: { createdBy: userId }, data: { status: 'hidden' } });
        return NextResponse.json({ success: true, message: `تم إخفاء ${result.count} عقار` });
      }

      case 'show-apartments': {
        const result = await db.apartment.updateMany({ where: { createdBy: userId, status: 'hidden' }, data: { status: 'pending' } });
        return NextResponse.json({ success: true, message: `تم إعادة ${result.count} عقار للمراجعة` });
      }

      case 'delete': {
        // CRITICAL FIX: Wrap ALL cascade deletes in a transaction
        await db.$transaction(async (tx) => {
          await tx.message.deleteMany({ where: { senderId: userId } });
          await tx.like.deleteMany({ where: { userId } });
          await tx.comment.deleteMany({ where: { userId } });
          await tx.propertyEditRequest.deleteMany({ where: { userId } });
          
          const userInquiries = await tx.inquiry.findMany({ where: { userId }, select: { id: true } });
          if (userInquiries.length > 0) {
            await tx.payment.deleteMany({ where: { inquiryId: { in: userInquiries.map(i => i.id) } } });
          }
          await tx.inquiry.deleteMany({ where: { userId } });
          
          const userApartments = await tx.apartment.findMany({ where: { createdBy: userId }, select: { id: true } });
          for (const apt of userApartments) {
            await tx.like.deleteMany({ where: { apartmentId: apt.id } });
            await tx.comment.deleteMany({ where: { apartmentId: apt.id } });
            await tx.propertyEditRequest.deleteMany({ where: { apartmentId: apt.id } });
            const aptInq = await tx.inquiry.findMany({ where: { apartmentId: apt.id }, select: { id: true } });
            if (aptInq.length > 0) {
              await tx.payment.deleteMany({ where: { inquiryId: { in: aptInq.map(i => i.id) } } });
            }
            await tx.inquiry.deleteMany({ where: { apartmentId: apt.id } });
          }
          await tx.apartment.deleteMany({ where: { createdBy: userId } });
          await tx.blockedUser.deleteMany({ where: { userId } });
          await tx.user.delete({ where: { id: userId } });
        });
        
        return NextResponse.json({ success: true, message: 'تم حذف المستخدم وكل بياناته نهائياً' });
      }

      default:
        return NextResponse.json({ error: 'إجراء غير صالح' }, { status: 400 });
    }
  } catch (error) {
    console.error('User management error:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

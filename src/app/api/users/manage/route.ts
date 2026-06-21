import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';
import { verify } from 'jsonwebtoken';
import { JWT_SECRET } from '@/lib/auth';

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
      decoded = verify(token, JWT_SECRET!);
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
        await db.user.update({
          where: { id: userId },
          data: {
            isBlocked: true,
            blockedAt: new Date(),
            blockReason: reason || 'تم الحظر من قبل الإدارة',
          },
        });
        await db.apartment.updateMany({
          where: { createdBy: userId },
          data: { status: 'hidden' },
        });
        await db.message.deleteMany({ where: { senderId: userId } });
        return NextResponse.json({ success: true, message: 'تم حظر المستخدم وإخفاء عقاراته' });
      }

      case 'unblock': {
        await db.user.update({
          where: { id: userId },
          data: { isBlocked: false, blockedAt: null, blockReason: null },
        });
        await db.apartment.updateMany({
          where: { createdBy: userId, status: 'hidden' },
          data: { status: 'pending' },
        });
        return NextResponse.json({ success: true, message: 'تم إلغاء حظر المستخدم' });
      }

      case 'revoke-contact': {
        const revoked = await db.inquiry.updateMany({
          where: { userId, lifecycleStatus: 'Contacted' },
          data: { lifecycleStatus: 'Revoked' },
        });
        await db.payment.updateMany({
          where: { userId, status: 'Paid' },
          data: { status: 'Refunded', inquiryStatus: 'Revoked' },
        });
        return NextResponse.json({ 
          success: true, 
          message: `تم إلغاء صلاحيات بيانات التواصل (${revoked.count} طلب)`,
        });
      }

      case 'hide-apartments': {
        const result = await db.apartment.updateMany({
          where: { createdBy: userId },
          data: { status: 'hidden' },
        });
        return NextResponse.json({ success: true, message: `تم إخفاء ${result.count} عقار` });
      }

      case 'show-apartments': {
        const result = await db.apartment.updateMany({
          where: { createdBy: userId, status: 'hidden' },
          data: { status: 'pending' },
        });
        return NextResponse.json({ success: true, message: `تم إعادة ${result.count} عقار للمراجعة` });
      }

      case 'delete': {
        await db.message.deleteMany({ where: { senderId: userId } });
        await db.like.deleteMany({ where: { userId } });
        await db.comment.deleteMany({ where: { userId } });
        await db.propertyEditRequest.deleteMany({ where: { userId } });
        const userInquiries = await db.inquiry.findMany({ where: { userId }, select: { id: true } });
        for (const inq of userInquiries) {
          await db.payment.deleteMany({ where: { inquiryId: inq.id } });
        }
        await db.inquiry.deleteMany({ where: { userId } });
        const userApartments = await db.apartment.findMany({ where: { createdBy: userId }, select: { id: true } });
        for (const apt of userApartments) {
          await db.like.deleteMany({ where: { apartmentId: apt.id } });
          await db.comment.deleteMany({ where: { apartmentId: apt.id } });
          await db.propertyEditRequest.deleteMany({ where: { apartmentId: apt.id } });
          const aptInq = await db.inquiry.findMany({ where: { apartmentId: apt.id }, select: { id: true } });
          for (const inq of aptInq) {
            await db.payment.deleteMany({ where: { inquiryId: inq.id } });
          }
          await db.inquiry.deleteMany({ where: { apartmentId: apt.id } });
        }
        await db.apartment.deleteMany({ where: { createdBy: userId } });
        await db.blockedUser.deleteMany({ where: { userId } });
        await db.user.delete({ where: { id: userId } });
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

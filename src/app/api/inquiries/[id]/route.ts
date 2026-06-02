import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';
import { verify } from 'jsonwebtoken';
import { JWT_SECRET } from '@/lib/auth';
import { broadcastEvent, WebhookEvents } from '@/lib/webhook';
import { sendInquiryApprovedEmail, sendNewInquiryEmail } from '@/lib/email';



export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });
    }
    let decoded: any;
    try {
      decoded = verify(token, JWT_SECRET);
    } catch {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }

    if (decoded.role !== 'DEVELOPER') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    }

    const { id } = await params;
    const data = await request.json();

    const inquiry = await db.inquiry.update({
      where: { id },
      data: {
        lifecycleStatus: data.lifecycleStatus
      }
    });

    try { await broadcastEvent(WebhookEvents.MESSAGES_CHANGED); } catch {}

    // إرسال إيميل للمستخدم عند الموافقة
    if (data.lifecycleStatus === 'approved') {
      const inquiryUser = await db.inquiry.findUnique({
        where: { id },
        include: { apartment: { select: { title: true } }, user: { select: { name: true, email: true } } },
      });
      if (inquiryUser?.user?.email) {
        try { await sendInquiryApprovedEmail({ to: inquiryUser.user.email, name: inquiryUser.user.name, apartmentTitle: inquiryUser.apartment?.title }); } catch {}
      }
    }

    return NextResponse.json({
      id: inquiry.id,
      lifecycleStatus: inquiry.lifecycleStatus
    });
  } catch (error) {
    console.error('Error updating inquiry:', error);
    return NextResponse.json({ error: 'Failed to update inquiry' }, { status: 500 });
  }
}

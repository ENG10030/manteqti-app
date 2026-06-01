import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthContext, requireApprovedUser } from '@/lib/auth-middleware';
import { sendNewMessageEmail } from '@/lib/email';
import { notifyRealtime } from '@/lib/realtime';

export const dynamic = "force-dynamic";

// جلب الرسائل
export async function GET(request: NextRequest) {
  try {
    // CRITICAL FIX: Use getAuthContext — DB-backed isBlocked check
    const { auth, errorResponse } = await getAuthContext(request);
    if (errorResponse) return errorResponse;
    if (!auth) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

    const isDeveloper = auth.role === 'DEVELOPER';
    let messages;

    if (isDeveloper) {
      messages = await db.message.findMany({
        where: { OR: [{ receiverId: null }, { senderId: auth.userId }] },
        include: { sender: { select: { id: true, name: true, identifier: true } } },
        orderBy: { createdAt: 'desc' }
      });
    } else {
      messages = await db.message.findMany({
        where: { OR: [{ senderId: auth.userId }, { receiverId: auth.userId }] },
        include: { sender: { select: { id: true, name: true, identifier: true } } },
        orderBy: { createdAt: 'desc' }
      });
    }

    return NextResponse.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

// إرسال رسالة جديدة
export async function POST(request: NextRequest) {
  try {
    // Rate limiting removed (module not available)

    const { auth, errorResponse } = await requireApprovedUser(request);
    if (errorResponse || !auth) return errorResponse!;

    const body = await request.json();
    const { content, receiverId } = body;

    if (!content || !content.trim()) {
      return NextResponse.json({ error: 'بيانات ناقصة' }, { status: 400 });
    }

    const sanitizedContent = content.trim().replace(/<[^>]*>/g, '').slice(0, 2000);
    if (!sanitizedContent) {
      return NextResponse.json({ error: 'محتوى الرسالة غير صالح' }, { status: 400 });
    }

    const message = await db.message.create({
      data: { senderId: auth.userId, receiverId: receiverId || null, content: sanitizedContent },
      include: { sender: { select: { id: true, name: true, identifier: true } } }
    });

    if (process.env.RESEND_API_KEY && receiverId) {
      const [sender, receiver] = await Promise.all([
        db.user.findUnique({ where: { id: auth.userId }, select: { name: true } }),
        db.user.findUnique({ where: { id: receiverId }, select: { name: true, email: true } }),
      ]);
      if (receiver?.email && sender?.name) {
        sendNewMessageEmail({ to: receiver.email, name: receiver.name, senderName: sender.name });
      }
    }

    notifyRealtime('message-sent', { senderId: auth.userId, receiverId });
    return NextResponse.json({ success: true, message });
  } catch (error) {
    console.error('Error sending message:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

// حذف رسالة (المطور فقط)
export async function DELETE(request: NextRequest) {
  try {
    // CRITICAL FIX: Use getAuthContext for DB-backed auth
    const { auth, errorResponse } = await getAuthContext(request);
    if (errorResponse) return errorResponse;
    if (!auth) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

    if (auth.role !== 'DEVELOPER') {
      return NextResponse.json({ error: 'غير مصرح - فقط المطور يمكنه حذف الرسائل' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const messageId = searchParams.get('id');
    if (!messageId) {
      return NextResponse.json({ error: 'معرف الرسالة مطلوب' }, { status: 400 });
    }

    const message = await db.message.findUnique({ where: { id: messageId } });
    if (!message) {
      return NextResponse.json({ error: 'الرسالة غير موجودة' }, { status: 404 });
    }

    await db.message.delete({ where: { id: messageId } });

    try {
      await db.operationLog.create({
        data: {
          action: 'DELETE_MESSAGE', entityType: 'Message', entityId: messageId,
          details: `Deleted message from ${message.senderId}`, userId: auth.userId,
        },
      });
    } catch {}

    return NextResponse.json({ success: true, message: 'تم حذف الرسالة' });
  } catch (error) {
    console.error('Error deleting message:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

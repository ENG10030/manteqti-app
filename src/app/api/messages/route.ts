import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';
import { verify } from 'jsonwebtoken';
import { requireApprovedUser } from '@/lib/auth-middleware';

const JWT_SECRET = process.env.JWT_SECRET || "manteqti-secret-key-2024";

// Helper: get authenticated user from token
async function getAuthUser(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;
  if (!token) return null;
  try {
    const decoded = verify(token, JWT_SECRET) as { userId: string; role?: string };
    return decoded;
  } catch {
    return null;
  }
}

// جلب الرسائل
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthUser(request);
    if (!auth) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });
    }

    const isDeveloper = auth.role === 'DEVELOPER';
    let messages;

    if (isDeveloper) {
      messages = await db.message.findMany({
        where: {
          OR: [
            { receiverId: null },
            { senderId: auth.userId }
          ]
        },
        include: {
          sender: {
            select: { id: true, name: true, identifier: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
    } else {
      messages = await db.message.findMany({
        where: {
          OR: [
            { senderId: auth.userId },
            { receiverId: auth.userId }
          ]
        },
        include: {
          sender: {
            select: { id: true, name: true, identifier: true }
          }
        },
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
    const { auth, errorResponse } = await requireApprovedUser(request);
    if (errorResponse || !auth) return errorResponse!;

    const body = await request.json();
    const { content, receiverId } = body;

    if (!content || !content.trim()) {
      return NextResponse.json({ error: 'بيانات ناقصة' }, { status: 400 });
    }

    // Sanitize content - prevent XSS
    const sanitizedContent = content.trim().replace(/<[^>]*>/g, '').slice(0, 2000);

    if (!sanitizedContent) {
      return NextResponse.json({ error: 'محتوى الرسالة غير صالح' }, { status: 400 });
    }

    const message = await db.message.create({
      data: {
        senderId: auth.userId,
        receiverId: receiverId || null,
        content: sanitizedContent,
      },
      include: {
        sender: {
          select: { id: true, name: true, identifier: true }
        }
      }
    });

    return NextResponse.json({ success: true, message });
  } catch (error) {
    console.error('Error sending message:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

// حذف رسالة (المطور فقط)
export async function DELETE(request: NextRequest) {
  try {
    const auth = await getAuthUser(request);
    if (!auth) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });
    }

    // Only developer can delete messages
    if (auth.role !== 'DEVELOPER') {
      return NextResponse.json({ error: 'غير مصرح - فقط المطور يمكنه حذف الرسائل' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const messageId = searchParams.get('id');

    if (!messageId) {
      return NextResponse.json({ error: 'معرف الرسالة مطلوب' }, { status: 400 });
    }

    // Validate message exists
    const message = await db.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      return NextResponse.json({ error: 'الرسالة غير موجودة' }, { status: 404 });
    }

    // Delete the message
    await db.message.delete({
      where: { id: messageId },
    });

    // Log the deletion
    try {
      await db.operationLog.create({
        data: {
          action: 'DELETE_MESSAGE',
          entityType: 'Message',
          entityId: messageId,
          details: `Deleted message from ${message.senderId}`,
          userId: auth.userId,
        },
      });
    } catch {}

    return NextResponse.json({ success: true, message: 'تم حذف الرسالة' });
  } catch (error) {
    console.error('Error deleting message:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
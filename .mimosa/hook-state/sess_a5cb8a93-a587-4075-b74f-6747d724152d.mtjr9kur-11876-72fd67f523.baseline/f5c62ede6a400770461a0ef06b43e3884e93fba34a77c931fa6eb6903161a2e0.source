import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';
import { verify } from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || "manteqti-secret-key-2024";

// جلب الرسائل
export async function GET(request: NextRequest) {
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

    const tokenUserId = decoded.userId;
    const isDeveloper = decoded.role === 'DEVELOPER';

    let messages;

    if (isDeveloper) {
      // المطور يرى جميع الرسائل المرسلة إليه
      messages = await db.message.findMany({
        where: { receiverId: null },
        include: {
          sender: {
            select: { id: true, name: true, identifier: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
    } else {
      // المستخدم يرى رسائله فقط (filter by token userId)
      messages = await db.message.findMany({
        where: {
          OR: [
            { senderId: tokenUserId },
            { receiverId: tokenUserId }
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

    const tokenUserId = decoded.userId;
    const body = await request.json();
    const { senderId, content, receiverId } = body;

    if (!content) {
      return NextResponse.json({ error: 'بيانات ناقصة' }, { status: 400 });
    }

    // Verify the sender matches the token user
    const effectiveSenderId = senderId || tokenUserId;
    if (effectiveSenderId !== tokenUserId) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    }

    // التحقق من أن المستخدم غير محظور
    const sender = await db.user.findUnique({
      where: { id: tokenUserId }
    });

    if (sender?.isBlocked) {
      return NextResponse.json({
        error: 'تم حظرك من استخدام الموقع. تواصل مع المطور.',
        isBlocked: true
      }, { status: 403 });
    }

    const message = await db.message.create({
      data: {
        senderId: tokenUserId,
        receiverId: receiverId || null,
        content,
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

// حذف رسالة أو مسح جميع الرسائل (للمطور)
export async function DELETE(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      // حذف رسالة واحدة
      try {
        await db.message.delete({ where: { id } });
        return NextResponse.json({ success: true, message: 'تم حذف الرسالة' });
      } catch {
        return NextResponse.json({ error: 'الرسالة غير موجودة' }, { status: 404 });
      }
    } else {
      // مسح جميع الرسائل المرسلة للمطور (receiverId: null)
      try {
        await db.message.deleteMany({ where: { receiverId: null } });
        return NextResponse.json({ success: true, message: 'تم مسح جميع الرسائل' });
      } catch {
        return NextResponse.json({ error: 'حدث خطأ أثناء مسح الرسائل' }, { status: 500 });
      }
    }
  } catch (error) {
    console.error('Error deleting messages:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

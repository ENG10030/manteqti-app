import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// جلب الرسائل
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const isDeveloper = searchParams.get('isDeveloper') === 'true';

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
    } else if (userId) {
      // المستخدم يرى رسائله فقط
      messages = await db.message.findMany({
        where: {
          OR: [
            { senderId: userId },
            { receiverId: userId }
          ]
        },
        include: {
          sender: {
            select: { id: true, name: true, identifier: true }
          },
          receiver: {
            select: { id: true, name: true, identifier: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
    } else {
      return NextResponse.json({ error: 'مطلوب معرف المستخدم' }, { status: 400 });
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
    const body = await request.json();
    const { senderId, content, receiverId } = body;

    if (!senderId || !content) {
      return NextResponse.json({ error: 'بيانات ناقصة' }, { status: 400 });
    }

    // التحقق من أن المستخدم غير محظور
    const sender = await db.user.findUnique({
      where: { id: senderId }
    });

    if (sender?.isBlocked) {
      return NextResponse.json({
        error: 'تم حظرك من استخدام الموقع. تواصل مع المطور.',
        isBlocked: true
      }, { status: 403 });
    }

    const message = await db.message.create({
      data: {
        senderId,
        receiverId: receiverId || null, // null يعني رسالة للمطور
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

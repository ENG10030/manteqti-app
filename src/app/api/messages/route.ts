import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth, requireDeveloper } from '@/lib/auth';
import { sendNewMessageEmail } from '@/lib/email';

/**
 * GET /api/messages
 * Require auth. Return messages for current user.
 * Developer can fetch messages for any user with ?userId=xxx&isDeveloper=true
 */
export async function GET(request: NextRequest) {
  try {
    const decoded = await verifyAuth(request);
    if (!decoded) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get('userId');
    const isDeveloper = searchParams.get('isDeveloper') === 'true';

    if (isDeveloper && decoded.role === 'DEVELOPER' && targetUserId) {
      // Developer fetching messages for a specific user
      const messages = await db.message.findMany({
        where: {
          OR: [
            { senderId: targetUserId },
            { receiverId: targetUserId },
          ],
        },
        orderBy: { createdAt: 'desc' },
        include: {
          sender: { select: { id: true, name: true, identifier: true } },
        },
      });
      return NextResponse.json(messages);
    }

    // Regular user: fetch their own messages (sent or received)
    const messages = await db.message.findMany({
      where: {
        OR: [
          { senderId: decoded.id },
          { receiverId: decoded.id },
        ],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        sender: { select: { id: true, name: true, identifier: true } },
      },
    });

    return NextResponse.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

/**
 * POST /api/messages
 * Require auth. Create a message.
 * Body: { senderId, receiverId, content }
 */
export async function POST(request: NextRequest) {
  try {
    const decoded = await verifyAuth(request);
    if (!decoded) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }

    const body = await request.json();
    const { receiverId, content } = body;

    if (!receiverId || !content || !content.trim()) {
      return NextResponse.json({ error: 'بيانات الرسالة مطلوبة' }, { status: 400 });
    }

    // Verify receiver exists
    const receiver = await db.user.findUnique({
      where: { id: receiverId },
    });

    if (!receiver) {
      return NextResponse.json({ error: 'المستقبل غير موجود' }, { status: 404 });
    }

    const message = await db.message.create({
      data: {
        senderId: decoded.id,
        receiverId,
        content: content.trim(),
        isRead: false,
      },
      include: {
        sender: { select: { id: true, name: true, identifier: true } },
      },
    });

    // Send email notification to receiver (fire-and-forget)
    if (receiver.email) {
      sendNewMessageEmail({
        to: receiver.email,
        name: receiver.name,
        senderName: decoded.name,
      }).catch((err) => {
        console.error('Failed to send message notification email:', err);
      });
    }

    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    console.error('Error creating message:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء إرسال الرسالة' }, { status: 500 });
  }
}

/**
 * DELETE /api/messages
 * Require developer auth. Delete message.
 * Query param: ?id=messageId
 */
export async function DELETE(request: NextRequest) {
  try {
    const decoded = await requireDeveloper(request);
    if (decoded instanceof Response) return decoded;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'معرف الرسالة مطلوب' }, { status: 400 });
    }

    const existingMessage = await db.message.findUnique({
      where: { id },
    });

    if (!existingMessage) {
      return NextResponse.json({ error: 'الرسالة غير موجودة' }, { status: 404 });
    }

    await db.message.delete({ where: { id } });

    // Log deletion
    try {
      await db.operationLog.create({
        data: {
          action: 'MESSAGE_DELETED',
          entityType: 'Message',
          entityId: id,
          details: JSON.stringify({ deletedBy: decoded.identifier }),
          userId: decoded.id,
        },
      });
    } catch {}

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting message:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

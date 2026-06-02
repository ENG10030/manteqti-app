import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireApprovedUser } from '@/lib/auth-middleware';
import { sanitizeString } from '@/lib/security';
import { broadcastEvent, WebhookEvents } from '@/lib/webhook';

// Fetch comments
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const apartmentId = searchParams.get('apartmentId');
    const status = searchParams.get('status');
    const userId = searchParams.get('userId');

    const where: Record<string, unknown> = {};
    if (apartmentId) where.apartmentId = apartmentId;
    if (status) where.status = status;
    if (userId) where.userId = userId;

    const comments = await db.comment.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            identifier: true,
          }
        },
        apartment: {
          select: {
            id: true,
            title: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(comments);
  } catch (error) {
    console.error('Error fetching comments:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

// Create comment
export async function POST(request: NextRequest) {
  try {
    const { auth, errorResponse } = await requireApprovedUser(request);
    if (errorResponse || !auth) return errorResponse!;

    const body = await request.json();
    const { apartmentId, content } = body;

    if (!apartmentId || !content) {
      return NextResponse.json({ error: 'بيانات ناقصة' }, { status: 400 });
    }

    if (content.length > 1000) {
      return NextResponse.json({ error: 'التعليق طويل جداً (الحد الأقصى 1000 حرف)' }, { status: 400 });
    }

    const isDeveloper = auth.role === 'DEVELOPER';
    const userId = auth.userId;

    // SECURITY: Sanitize content to prevent XSS
    const sanitizedContent = sanitizeString(content);

    const comment = await db.comment.create({
      data: {
        apartmentId,
        userId,
        content: sanitizedContent,
        status: isDeveloper ? 'approved' : 'pending',
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            identifier: true,
          }
        }
      }
    });

    try { await broadcastEvent(WebhookEvents.NOTIFICATIONS_CHANGED); } catch {}

    return NextResponse.json({ 
      success: true, 
      comment,
      message: isDeveloper ? 'تم نشر التعليق مباشرة' : 'تم إرسال تعليقك وهو في انتظار موافقة المطور' 
    });
  } catch (error) {
    console.error('Error creating comment:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';
import { verify } from 'jsonwebtoken';
import { requireApprovedUser } from '@/lib/auth-middleware';
import { JWT_SECRET } from '@/lib/auth';
import { broadcastEvent, WebhookEvents } from '@/lib/webhook';

// جلب كل الإعجابات أو إعجابات عقار معين
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const apartmentId = searchParams.get('apartmentId');
    const userId = searchParams.get('userId');

    const where: Record<string, unknown> = {};
    if (apartmentId) where.apartmentId = apartmentId;
    if (userId) where.userId = userId;

    const likes = await db.like.findMany({
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

    return NextResponse.json(likes);
  } catch (error) {
    console.error('Error fetching likes:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

// إضافة إعجاب جديد
export async function POST(request: NextRequest) {
  try {
    const { auth, errorResponse } = await requireApprovedUser(request);
    if (errorResponse || !auth) return errorResponse!;

    const body = await request.json();
    const { apartmentId } = body;

    if (!apartmentId) {
      return NextResponse.json({ error: 'بيانات ناقصة' }, { status: 400 });
    }

    // التحقق من عدم وجود إعجاب سابق
    const existingLike = await db.like.findUnique({
      where: {
        apartmentId_userId: {
          apartmentId,
          userId: auth.userId,
        }
      }
    });

    if (existingLike) {
      return NextResponse.json({ error: 'تم الإعجاب مسبقاً' }, { status: 400 });
    }

    const like = await db.like.create({
      data: {
        apartmentId,
        userId: auth.userId,
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

    return NextResponse.json({ success: true, like });
  } catch (error) {
    console.error('Error creating like:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

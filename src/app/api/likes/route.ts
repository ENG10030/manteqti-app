import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';
import { verify } from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || "manteqti-secret-key-2024";

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
    const { apartmentId, userId } = body;

    if (!apartmentId) {
      return NextResponse.json({ error: 'بيانات ناقصة' }, { status: 400 });
    }

    // Verify userId matches token
    const effectiveUserId = userId || tokenUserId;
    if (effectiveUserId !== tokenUserId) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    }

    // التحقق من عدم وجود إعجاب سابق
    const existingLike = await db.like.findUnique({
      where: {
        apartmentId_userId: {
          apartmentId,
          userId: tokenUserId,
        }
      }
    });

    if (existingLike) {
      return NextResponse.json({ error: 'تم الإعجاب مسبقاً' }, { status: 400 });
    }

    const like = await db.like.create({
      data: {
        apartmentId,
        userId: tokenUserId,
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

    return NextResponse.json({ success: true, like });
  } catch (error) {
    console.error('Error creating like:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

// مسح جميع الإعجابات (للمطور فقط)
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
    const clearAll = searchParams.get('clearAll');

    if (clearAll === 'true') {
      // مسح جميع الإعجابات
      try {
        await db.like.deleteMany({});
        return NextResponse.json({ success: true, message: 'تم مسح جميع الإعجابات' });
      } catch {
        return NextResponse.json({ error: 'حدث خطأ أثناء مسح الإعجابات' }, { status: 500 });
      }
    } else {
      return NextResponse.json({ error: 'يجب تحديد clearAll=true لمسح الكل' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error deleting likes:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

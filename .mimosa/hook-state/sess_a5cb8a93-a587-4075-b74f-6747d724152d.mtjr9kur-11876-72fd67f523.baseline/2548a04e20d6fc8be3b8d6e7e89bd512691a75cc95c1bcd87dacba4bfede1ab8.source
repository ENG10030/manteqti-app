import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    const favorites = await db.like.findMany({
      where: { userId: user.id },
      include: {
        apartment: {
          include: {
            user: {
              select: { id: true, name: true, phone: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ favorites });
  } catch (error: unknown) {
    if (error instanceof Error && (error.message.includes('تسجيل الدخول') || error.message.includes('تأكيد البريد') || error.message.includes('حظر'))) {
      return NextResponse.json({ error: error.message }, { status: error.message.includes('حظر') ? 403 : 401 });
    }
    console.error('Get favorites error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ أثناء جلب المفضلة' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    const body = await request.json();
    const { apartmentId } = body;

    if (!apartmentId || typeof apartmentId !== 'string') {
      return NextResponse.json(
        { error: 'يرجى تحديد العقار' },
        { status: 400 }
      );
    }

    // Check if apartment exists
    const apartment = await db.apartment.findUnique({
      where: { id: apartmentId },
    });

    if (!apartment) {
      return NextResponse.json(
        { error: 'العقار غير موجود' },
        { status: 404 }
      );
    }

    // Check if already favorited (use the unique constraint)
    const existingLike = await db.like.findUnique({
      where: {
        apartmentId_userId: {
          userId: user.id,
          apartmentId,
        },
      },
    });

    if (existingLike) {
      // Remove from favorites
      await db.like.delete({
        where: { id: existingLike.id },
      });

      return NextResponse.json({
        message: 'تم إزالة العقار من المفضلة',
        isFavorited: false,
      });
    }

    // Add to favorites
    const favorite = await db.like.create({
      data: {
        userId: user.id,
        apartmentId,
      },
    });

    return NextResponse.json(
      {
        message: 'تم إضافة العقار إلى المفضلة',
        isFavorited: true,
        favorite,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    if (error instanceof Error && (error.message.includes('تسجيل الدخول') || error.message.includes('تأكيد البريد') || error.message.includes('حظر'))) {
      return NextResponse.json({ error: error.message }, { status: error.message.includes('حظر') ? 403 : 401 });
    }
    console.error('Toggle favorite error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ أثناء تحديث المفضلة' },
      { status: 500 }
    );
  }
}

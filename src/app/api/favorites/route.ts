import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const auth = authenticateRequest(request);

    if (!auth) {
      return NextResponse.json(
        { error: 'يرجى تسجيل الدخول' },
        { status: 401 }
      );
    }

    const favorites = await db.like.findMany({
      where: { userId: auth.user.id },
      include: {
        apartment: {
          include: {
            user: {
              select: { id: true, name: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ favorites });
  } catch (error: unknown) {
    console.error('Get favorites error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ أثناء جلب المفضلة' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = authenticateRequest(request);

    if (!auth) {
      return NextResponse.json(
        { error: 'يرجى تسجيل الدخول لإضافة إلى المفضلة' },
        { status: 401 }
      );
    }

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
          userId: auth.user.id,
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
        userId: auth.user.id,
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
    console.error('Toggle favorite error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ أثناء تحديث المفضلة' },
      { status: 500 }
    );
  }
}

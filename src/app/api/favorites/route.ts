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

    // ⛔ SECURITY: select صريح — بدون هاتف/واتساب/خريطة المالك أو هاتف صاحب الحساب
    // (كان الـ include الكامل بيسرّب بيانات التواصل اللي خلف جدار الدفع)
    const favorites = await db.like.findMany({
      where: { userId: auth.user.id },
      orderBy: { createdAt: 'desc' },
    });

    const apartmentIds = [...new Set(favorites.map(f => f.apartmentId))];
    const apartments = apartmentIds.length > 0 ? await db.apartment.findMany({
      where: { id: { in: apartmentIds } },
      select: {
        id: true, title: true, description: true, price: true, area: true,
        bedrooms: true, bathrooms: true, floor: true, apartmentSize: true,
        type: true, status: true, imageUrl: true, images: true, videos: true,
        amenities: true, isFeatured: true, isVip: true, createdAt: true, updatedAt: true,
      },
    }) : [];
    const apartmentMap = new Map(apartments.map(a => [a.id, a]));

    return NextResponse.json({
      favorites: favorites.map(f => ({ ...f, apartment: apartmentMap.get(f.apartmentId) || null })),
    });
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

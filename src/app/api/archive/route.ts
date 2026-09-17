import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireDeveloper } from '@/lib/auth-middleware';

// الأرشيف — المطور فقط
// GET: جلب العقارات المؤرشفة (التي أُرشفت تلقائياً بعد 48 ساعة في حالة نهائية)
// POST: استعادة عقار من الأرشيف { id, action: 'restore' }

export async function GET(request: NextRequest) {
  try {
    const { errorResponse } = await requireDeveloper(request);
    if (errorResponse) return errorResponse;

    const archived = await db.apartment.findMany({
      where: { archivedAt: { not: null } },
      orderBy: { archivedAt: 'desc' },
      select: {
        id: true,
        title: true,
        price: true,
        area: true,
        type: true,
        status: true,
        statusChangedAt: true,
        archivedAt: true,
        imageUrl: true,
        images: true,
        views: true,
      },
    });

    return NextResponse.json({ archived, count: archived.length });
  } catch (error) {
    console.error('Get archived apartments error:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء جلب الأرشيف' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { auth, errorResponse } = await requireDeveloper(request);
    if (errorResponse) return errorResponse;

    const body = await request.json();
    const { id, action } = body;

    if (!id || action !== 'restore') {
      return NextResponse.json({ error: 'طلب غير صالح' }, { status: 400 });
    }

    const apartment = await db.apartment.findUnique({ where: { id } });
    if (!apartment) {
      return NextResponse.json({ error: 'العقار غير موجود' }, { status: 404 });
    }

    if (!apartment.archivedAt) {
      return NextResponse.json({ error: 'العقار ليس في الأرشيف' }, { status: 400 });
    }

    const restored = await db.apartment.update({
      where: { id },
      data: {
        archivedAt: null,
        status: 'available',
        statusChangedAt: null,
      },
    });

    await db.operationLog.create({
      data: {
        action: 'archive_restore',
        entityType: 'apartment',
        entityId: id,
        userId: auth.userId,
        details: `استعادة من الأرشيف: ${apartment.title}`,
      },
    });

    return NextResponse.json({
      message: `تمت استعادة "${apartment.title}" من الأرشيف ✅`,
      apartment: restored,
    });
  } catch (error) {
    console.error('Restore apartment error:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء الاستعادة' }, { status: 500 });
  }
}

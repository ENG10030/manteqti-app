import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// جلب كل العقارات
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const status = searchParams.get('status');
    const minPrice = searchParams.get('minPrice');
    const maxPrice = searchParams.get('maxPrice');
    const bedrooms = searchParams.get('bedrooms');

    const where: Record<string, unknown> = {};

    if (type) where.type = type;
    if (status) where.status = status;
    if (minPrice || maxPrice) {
      const priceFilter: { gte?: number; lte?: number } = {};
      if (minPrice) priceFilter.gte = parseInt(minPrice);
      if (maxPrice) priceFilter.lte = parseInt(maxPrice);
      where.price = priceFilter;
    }
    if (bedrooms) where.bedrooms = { gte: parseInt(bedrooms) };

    const apartments = await db.apartment.findMany({
      where,
      orderBy: [
        { isVip: 'desc' },
        { isFeatured: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    return NextResponse.json(apartments);
  } catch (error) {
    console.error('Error fetching apartments:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

// إنشاء عقار جديد
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const apartment = await db.apartment.create({
      data: {
        title: body.title,
        description: body.description || '',
        price: parseInt(body.price),
        area: body.area || '',
        bedrooms: parseInt(body.bedrooms) || 0,
        bathrooms: parseInt(body.bathrooms) || 0,
        type: body.type || 'rent',
        status: body.status || 'pending', // الافتراضي: في انتظار الموافقة
        ownerPhone: body.ownerPhone || '',
        mapLink: body.mapLink || '',
        images: body.images,
        videos: body.videos,
        amenities: body.amenities,
        isFeatured: body.isFeatured || false,
        isVip: body.isVip || false,
        createdBy: body.createdBy || null, // من أنشأ العقار
      },
    });

    return NextResponse.json({
      success: true,
      apartment,
      message: body.status === 'pending' 
        ? 'تم إرسال العقار للمراجعة' 
        : 'تم إضافة العقار بنجاح'
    });
  } catch (error) {
    console.error('Error creating apartment:', error);
    return NextResponse.json({ 
      error: 'حدث خطأ أثناء إضافة العقار' 
    }, { status: 500 });
  }
}

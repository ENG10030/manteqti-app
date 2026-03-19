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
    const area = searchParams.get('area');

    interface WhereClause {
      type?: string;
      status?: string;
      price?: { gte?: number; lte?: number };
      bedrooms?: { gte?: number };
      area?: string;
    }
    
    const where: WhereClause = {};

    if (type && ['rent', 'sale'].includes(type)) where.type = type;
    if (status) where.status = status;
    if (area) where.area = area;
    
    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) where.price.gte = parseInt(minPrice);
      if (maxPrice) where.price.lte = parseInt(maxPrice);
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
    return NextResponse.json({ error: 'حدث خطأ في جلب العقارات' }, { status: 500 });
  }
}

// إنشاء عقار جديد
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.title || !body.price || !body.area) {
      return NextResponse.json({ 
        error: 'العنوان والسعر والمنطقة مطلوبون' 
      }, { status: 400 });
    }

    const apartment = await db.apartment.create({
      data: {
        title: body.title,
        description: body.description || '',
        price: parseInt(body.price) || 0,
        area: body.area || '',
        bedrooms: parseInt(body.bedrooms) || 0,
        bathrooms: parseInt(body.bathrooms) || 0,
        type: body.type || 'rent',
        status: body.status || 'pending',
        ownerPhone: body.ownerPhone || '',
        mapLink: body.mapLink || '',
        imageUrl: body.imageUrl || null,
        images: body.images || null,
        videoUrl: body.videoUrl || null,
        videos: body.videos || null,
        amenities: body.amenities || null,
        featured: body.featured || false,
        isFeatured: body.isFeatured || false,
        isVip: body.isVip || false,
        createdBy: body.createdBy || null,
      },
    });

    return NextResponse.json({
      success: true,
      apartment,
      message: 'تم إضافة العقار بنجاح'
    });
  } catch (error) {
    console.error('Error creating apartment:', error);
    return NextResponse.json({ 
      error: 'حدث خطأ أثناء إضافة العقار' 
    }, { status: 500 });
  }
}

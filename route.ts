import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

// Initialize Prisma Client
const prisma = new PrismaClient();

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
      where.price = {};
      if (minPrice) where.price.gte = parseInt(minPrice);
      if (maxPrice) where.price.lte = parseInt(maxPrice);
    }
    if (bedrooms) where.bedrooms = { gte: parseInt(bedrooms) };

    const apartments = await prisma.apartment.findMany({
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

    const apartment = await prisma.apartment.create({
      data: {
        title: body.title,
        description: body.description || '',
        price: parseInt(body.price),
        area: body.area || '',
        bedrooms: parseInt(body.bedrooms) || 0,
        bathrooms: parseInt(body.bathrooms) || 0,
        type: body.type || 'rent',
        status: body.status || 'available',
        ownerPhone: body.ownerPhone || '',
        mapLink: body.mapLink || '',
        images: body.images,
        videos: body.videos,
        amenities: body.amenities,
        isFeatured: body.isFeatured || false,
        isVip: body.isVip || false,
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

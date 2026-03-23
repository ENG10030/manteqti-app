import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - Fetch apartments
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const status = searchParams.get('status');
    const minPrice = searchParams.get('minPrice');
    const maxPrice = searchParams.get('maxPrice');
    const bedrooms = searchParams.get('bedrooms');
    const userId = searchParams.get('userId');
    const my = searchParams.get('my');
    const showHidden = searchParams.get('showHidden'); // للمطور لعرض المحذوفات

    // إذا كان الطلب للحصول على عقارات المستخدم الحالي
    if (my === 'true') {
      if (!userId) {
        return NextResponse.json({ error: 'مطلوب تسجيل الدخول' }, { status: 401 });
      }
      
      const myApartments = await db.apartment.findMany({
        where: { createdBy: userId },
        orderBy: { createdAt: 'desc' },
      });
      
      return NextResponse.json(myApartments);
    }

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

    // إخفاء عقارات المستخدمين المحظورين (ما لم يكن المطور)
    if (showHidden !== 'true') {
      // جلب قائمة المستخدمين المحظورين
      const blockedUsers = await db.blockedUser.findMany({
        select: { userId: true }
      });
      const blockedUserIds = blockedUsers.map(b => b.userId);
      
      // استبعاد عقارات المحظورين
      if (blockedUserIds.length > 0) {
        where.NOT = {
          createdBy: { in: blockedUserIds }
        };
      }
    }

    // الترتيب: VIP أولاً، ثم المميز، ثم الأحدث
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

// POST - Create new apartment
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // التحقق من حالة الحظر إذا كان هناك مستخدم
    if (body.createdBy) {
      const user = await db.user.findUnique({
        where: { id: body.createdBy }
      });

      if (user?.isBlocked) {
        return NextResponse.json({ 
          error: 'تم حظر حسابك. لا يمكنك إضافة عقارات جديدة.',
          blocked: true
        }, { status: 403 });
      }
      
      // التحقق من وجود حظر في جدول BlockedUser
      const blockedRecord = await db.blockedUser.findFirst({
        where: { userId: body.createdBy }
      });
      
      if (blockedRecord) {
        return NextResponse.json({ 
          error: 'تم حظر حسابك. لا يمكنك إضافة عقارات جديدة.',
          blocked: true
        }, { status: 403 });
      }
    }

    // تحديد الحالة الافتراضية بناءً على المطور
    const isDeveloperRequest = body.isDeveloper === true;
    const defaultStatus = isDeveloperRequest ? 'available' : 'pending';

    const apartment = await db.apartment.create({
      data: {
        title: body.title,
        description: body.description || '',
        price: parseInt(body.price),
        area: body.area || '',
        bedrooms: parseInt(body.bedrooms) || 0,
        bathrooms: parseInt(body.bathrooms) || 0,
        type: body.type || 'rent',
        status: body.status || defaultStatus,
        ownerPhone: body.ownerPhone || '',
        mapLink: body.mapLink || '',
        images: body.images,
        videos: body.videos,
        amenities: body.amenities,
        isFeatured: body.isFeatured || false,
        isVip: body.isVip || false,
        createdBy: body.createdBy || null,
        // إذا كان المطور، سجل الموافقة تلقائياً
        approvedBy: isDeveloperRequest ? 'developer' : null,
        approvedAt: isDeveloperRequest ? new Date() : null,
      },
    });

    return NextResponse.json({
      success: true,
      apartment,
      message: apartment.status === 'pending' 
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

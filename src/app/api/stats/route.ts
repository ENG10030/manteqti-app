import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest, isDeveloperOrAdmin } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const auth = authenticateRequest(request);

    if (!auth || !isDeveloperOrAdmin(auth.user)) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية الوصول' },
        { status: 403 }
      );
    }

    const [
      totalApartments,
      totalUsers,
      pendingApartments,
      rentApartments,
      saleApartments,
      totalInquiries,
      totalFavorites,
    ] = await Promise.all([
      db.apartment.count(),
      db.user.count(),
      db.apartment.count({ where: { status: 'pending' } }),
      db.apartment.count({ where: { type: 'rent' } }),
      db.apartment.count({ where: { type: 'sale' } }),
      db.inquiry.count(),
      db.like.count(),
    ]);

    // Get apartments by area
    const apartmentsByAreaRaw = await db.apartment.groupBy({
      by: ['area'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    });

    const apartmentsByArea = apartmentsByAreaRaw.map((item) => ({
      area: item.area,
      count: item._count.id,
    }));

    // Get apartments by type
    const apartmentsByType = [
      { type: 'إيجار', typeEn: 'rent', count: rentApartments },
      { type: 'بيع', typeEn: 'sale', count: saleApartments },
    ];

    // Recent users (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentUsers = await db.user.count({
      where: { createdAt: { gte: sevenDaysAgo } },
    });

    // Recent apartments (last 7 days)
    const recentApartments = await db.apartment.count({
      where: { createdAt: { gte: sevenDaysAgo } },
    });

    return NextResponse.json({
      totalApartments,
      totalUsers,
      pendingApartments,
      rentCount: rentApartments,
      saleCount: saleApartments,
      totalInquiries,
      totalFavorites,
      apartmentsByArea,
      apartmentsByType,
      recentUsers,
      recentApartments,
    });
  } catch (error: unknown) {
    console.error('Get stats error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ أثناء جلب الإحصائيات' },
      { status: 500 }
    );
  }
}

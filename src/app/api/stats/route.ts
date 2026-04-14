import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireDeveloper } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    await requireDeveloper(request);

    const [
      totalApartments,
      totalUsers,
      pendingApartments,
      rentApartments,
      saleApartments,
      totalInquiries,
      totalFavorites,
      blockedUsers,
    ] = await Promise.all([
      db.apartment.count(),
      db.user.count(),
      db.apartment.count({ where: { status: 'pending' } }),
      db.apartment.count({ where: { type: 'rent' } }),
      db.apartment.count({ where: { type: 'sale' } }),
      db.inquiry.count(),
      db.like.count(),
      db.user.count({ where: { isBlocked: true } }),
    ]);

    // Get apartments by area
    const apartmentsByAreaRaw = await db.apartment.groupBy({
      by: ['area'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 15,
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

    // Recent favorites (last 7 days)
    const recentFavorites = await db.like.count({
      where: { createdAt: { gte: sevenDaysAgo } },
    });

    // ========== FAVORITES STATISTICS ==========
    
    // Most favorited apartments (top 10)
    const mostFavoritedRaw = await db.like.groupBy({
      by: ['apartmentId'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });

    const mostFavoritedApartments = await Promise.all(
      mostFavoritedRaw.map(async (item) => {
        const apartment = await db.apartment.findUnique({
          where: { id: item.apartmentId },
          select: {
            id: true,
            title: true,
            price: true,
            area: true,
            type: true,
            status: true,
            imageUrl: true,
            user: { select: { id: true, name: true } },
          },
        });
        return {
          apartment,
          likeCount: item._count.id,
        };
      })
    );

    // Users who favorited most (top 10)
    const topFavoritingUsersRaw = await db.like.groupBy({
      by: ['userId'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });

    const topFavoritingUsers = await Promise.all(
      topFavoritingUsersRaw.map(async (item) => {
        const user = await db.user.findUnique({
          where: { id: item.userId },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            identifier: true,
            createdAt: true,
          },
        });
        return {
          user,
          favoriteCount: item._count.id,
        };
      })
    );

    // Favorites timeline (last 30 days, grouped by day)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentFavoritesList = await db.like.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      include: {
        user: {
          select: { id: true, name: true, email: true, identifier: true },
        },
        apartment: {
          select: { id: true, title: true, price: true, area: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Group by date
    const favoritesByDate: Record<string, number> = {};
    recentFavoritesList.forEach((like) => {
      const dateKey = like.createdAt.toISOString().split('T')[0];
      favoritesByDate[dateKey] = (favoritesByDate[dateKey] || 0) + 1;
    });

    const favoritesTimeline = Object.entries(favoritesByDate)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Favorites by area
    const favoritesByAreaRaw = await db.$queryRaw<
      Array<{ area: string; count: bigint }>
    >`
      SELECT a."area", COUNT(l.id) as count
      FROM "Like" l
      JOIN "Apartment" a ON l."apartmentId" = a.id
      GROUP BY a."area"
      ORDER BY count DESC
      LIMIT 15
    `;

    const favoritesByArea = favoritesByAreaRaw.map((item) => ({
      area: item.area,
      count: Number(item.count),
    }));

    return NextResponse.json({
      totalApartments,
      totalUsers,
      pendingApartments,
      rentCount: rentApartments,
      saleCount: saleApartments,
      totalInquiries,
      totalFavorites,
      blockedUsers,
      apartmentsByArea,
      apartmentsByType,
      recentUsers,
      recentApartments,
      recentFavorites,
      // Favorites specific stats
      mostFavoritedApartments,
      topFavoritingUsers,
      recentFavoritesList,
      favoritesTimeline,
      favoritesByArea,
    });
  } catch (error: unknown) {
    if (error instanceof Error && (error.message.includes('تسجيل الدخول') || error.message.includes('غير مصرح'))) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error('Get stats error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ أثناء جلب الإحصائيات' },
      { status: 500 }
    );
  }
}

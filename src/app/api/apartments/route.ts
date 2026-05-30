import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth } from '@/lib/auth';

/**
 * GET /api/apartments
 * Return apartments. No auth needed, but:
 * - Non-logged users: DON'T include ownerPhone
 * - Logged in users: include ownerPhone only for paid apartments
 * - Developer: always sees everything
 * Supports filtering: ?status=pending, ?type=rent|sale, etc.
 */
export async function GET(request: NextRequest) {
  try {
    const decoded = await verifyAuth(request);
    const isDeveloper = decoded?.role === 'DEVELOPER';
    const isLoggedIn = !!decoded;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const where: Record<string, unknown> = {};
    if (status) {
      where.status = status;
    }

    const apartments = await db.apartment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { likes: true, comments: true, inquiries: true } },
      },
    });

    // Get paid apartment IDs for the current user (if logged in)
    let paidApartmentIds: Set<string> = new Set();
    if (isLoggedIn && !isDeveloper) {
      const userPayments = await db.payment.findMany({
        where: {
          userId: decoded!.id,
          status: 'Paid',
        },
        include: {
          inquiry: { select: { apartmentId: true } },
        },
      });
      userPayments.forEach((p) => {
        if (p.inquiry?.apartmentId) {
          paidApartmentIds.add(p.inquiry.apartmentId);
        }
      });
    }

    // Process apartments: hide ownerPhone for non-authorized users
    const processedApartments = apartments.map((apt) => {
      if (isDeveloper) return apt; // Developer sees everything
      if (isLoggedIn && paidApartmentIds.has(apt.id)) return apt; // Paid user sees phone
      // Strip ownerPhone
      const { ownerPhone, ...rest } = apt;
      return { ...rest, ownerPhone: null };
    });

    return NextResponse.json(processedApartments);
  } catch (error) {
    console.error('Error fetching apartments:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

/**
 * POST /api/apartments
 * Require auth. Create apartment with status 'pending'.
 */
export async function POST(request: NextRequest) {
  try {
    const decoded = await verifyAuth(request);
    if (!decoded) {
      return NextResponse.json({ error: 'غير مصرح - يرجى تسجيل الدخول' }, { status: 401 });
    }

    const body = await request.json();
    const { title, description, type, price, area, bedrooms, bathrooms, ownerPhone, mapLink, images, videos, amenities, isFeatured, isVip } = body;

    if (!title || !type || !price || !area) {
      return NextResponse.json({ error: 'العنوان والنوع والسعر والمنطقة مطلوبون' }, { status: 400 });
    }

    const apartment = await db.apartment.create({
      data: {
        title,
        description: description || '',
        type: type === 'sale' ? 'sale' : 'rent',
        price: parseFloat(price) || 0,
        area: area || '',
        bedrooms: parseInt(bedrooms) || 1,
        bathrooms: parseInt(bathrooms) || 1,
        ownerPhone: ownerPhone || null,
        mapLink: mapLink || null,
        images: Array.isArray(images) ? JSON.stringify(images) : images || null,
        videos: Array.isArray(videos) ? JSON.stringify(videos) : videos || null,
        amenities: Array.isArray(amenities) ? JSON.stringify(amenities) : amenities || null,
        isFeatured: isFeatured || false,
        isVip: isVip || false,
        status: 'pending',
        createdBy: decoded.id,
      },
    });

    // Log apartment creation
    try {
      await db.operationLog.create({
        data: {
          action: 'APARTMENT_CREATED',
          entityType: 'Apartment',
          entityId: apartment.id,
          details: JSON.stringify({
            title: apartment.title,
            type: apartment.type,
            price: apartment.price,
            createdBy: decoded.identifier,
          }),
          userId: decoded.id,
        },
      });
    } catch {}

    return NextResponse.json(apartment, { status: 201 });
  } catch (error) {
    console.error('Error creating apartment:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء إنشاء العقار' }, { status: 500 });
  }
}

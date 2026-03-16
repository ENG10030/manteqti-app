import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Real apartment images from Unsplash (high-quality real estate photos)
const sampleImages = [
  'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=80',
  'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80',
  'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&q=80',
  'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800&q=80',
  'https://images.unsplash.com/photo-1507089947368-19c1da9775ae?w=800&q=80',
  'https://images.unsplash.com/photo-1560185007-cde436f6a4d0?w=800&q=80',
  'https://images.unsplash.com/photo-1560185127-6ed189bf02f4?w=800&q=80',
  'https://images.unsplash.com/photo-1560448075-cbc16bb4af8e?w=800&q=80'
];

export async function GET(request: NextRequest) {
  try {
    // Check if developer mode (via header or query param)
    const isDeveloper = request.headers.get('x-developer-mode') === 'true' ||
                        request.nextUrl.searchParams.get('dev') === 'true';

    const apartments = await db.apartment.findMany({
      orderBy: [
        { featured: 'desc' },
        { createdAt: 'desc' }
      ],
      include: {
        inquiries: {
          include: {
            payment: true
          }
        }
      }
    });

    // Transform to include agreement status from paid inquiries
    const transformedApartments = apartments
      .filter(apt => {
        // Developer sees all apartments
        if (isDeveloper) return true;
        // Regular users only see approved apartments (not pending)
        return apt.status !== 'pending';
      })
      .map((apt, index) => {
        const paidInquiry = apt.inquiries.find(inq => inq.payment?.status === 'Paid');
        const agreementStatus = paidInquiry?.payment?.inquiryStatus === 'Agreement Reached' ||
                                paidInquiry?.payment?.inquiryStatus === 'Contract Signed'
          ? paidInquiry.payment.inquiryStatus as 'Agreement Reached' | 'Contract Signed'
          : null;

        // Use provided image or fallback to sample images
        const imageUrl = apt.imageUrl || sampleImages[index % sampleImages.length];

        return {
          id: apt.id,
          title: apt.title,
          price: apt.price,
          area: apt.area,
          bedrooms: apt.bedrooms,
          bathrooms: apt.bathrooms,
          description: apt.description,
          ownerPhone: apt.ownerPhone,
          mapLink: apt.mapLink,
          imageUrl,
          images: apt.images ? JSON.parse(apt.images) : [imageUrl],
          videoUrl: apt.videoUrl,
          videos: apt.videos ? JSON.parse(apt.videos) : [],
          amenities: apt.amenities ? JSON.parse(apt.amenities) : ['موقف سيارات', 'أمن 24 ساعة', 'مصعد'],
          featured: apt.featured,
          type: apt.type as 'rent' | 'sale',
          status: apt.status || 'available',
          statusChangedAt: apt.statusChangedAt?.toISOString(),
          paymentRef: apt.paymentRef,
          createdBy: apt.createdBy,
          approvedBy: apt.approvedBy,
          approvedAt: apt.approvedAt?.toISOString(),
          agreementStatus,
          createdAt: apt.createdAt.toISOString()
        };
      });

    return NextResponse.json(transformedApartments);
  } catch (error) {
    console.error('Error fetching apartments:', error);
    return NextResponse.json({ error: 'Failed to fetch apartments' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();

    // Developer adds apartments directly as available
    const apartment = await db.apartment.create({
      data: {
        title: data.title,
        price: parseInt(data.price),
        area: data.area,
        bedrooms: parseInt(data.bedrooms),
        bathrooms: parseInt(data.bathrooms),
        description: data.description,
        ownerPhone: data.ownerPhone,
        mapLink: data.mapLink || '',
        imageUrl: data.imageUrl,
        images: data.images || null,
        videoUrl: data.videoUrl || null,
        videos: data.videos || null,
        amenities: data.amenities ? JSON.stringify(data.amenities) : null,
        featured: false, // Always false initially, developer can feature it
        type: data.type || 'rent',
        status: 'available', // Developer's apartments are available immediately
        paymentRef: data.paymentRef,
        createdBy: data.createdBy || 'developer',
        approvedBy: 'developer',
        approvedAt: new Date()
      }
    });

    // Log the creation
    await db.operationLog.create({
      data: {
        action: 'create',
        entityType: 'apartment',
        entityId: apartment.id,
        details: `New apartment created by developer: ${apartment.title}`
      }
    });

    return NextResponse.json(apartment);
  } catch (error) {
    console.error('Error creating apartment:', error);
    return NextResponse.json({ error: 'Failed to create apartment' }, { status: 500 });
  }
}

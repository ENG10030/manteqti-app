import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const apartment = await db.apartment.findUnique({
      where: { id },
      include: {
        inquiries: {
          include: {
            payment: true
          }
        }
      }
    });

    if (!apartment) {
      return NextResponse.json({ error: 'Apartment not found' }, { status: 404 });
    }

    const imageUrl = apartment.imageUrl || 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=80';

    return NextResponse.json({
      id: apartment.id,
      title: apartment.title,
      price: apartment.price,
      area: apartment.area,
      bedrooms: apartment.bedrooms,
      bathrooms: apartment.bathrooms,
      description: apartment.description,
      ownerPhone: apartment.ownerPhone,
      mapLink: apartment.mapLink,
      imageUrl,
      images: apartment.images ? JSON.parse(apartment.images) : [imageUrl],
      amenities: apartment.amenities ? JSON.parse(apartment.amenities) : [],
      featured: apartment.featured,
      type: apartment.type as 'rent' | 'sale',
      status: apartment.status || 'available',
      statusChangedAt: apartment.statusChangedAt?.toISOString(),
      views: apartment.views,
      paymentRef: apartment.paymentRef,
      createdBy: apartment.createdBy,
      approvedBy: apartment.approvedBy,
      approvedAt: apartment.approvedAt?.toISOString(),
      createdAt: apartment.createdAt.toISOString()
    });
  } catch (error) {
    console.error('Error fetching apartment:', error);
    return NextResponse.json({ error: 'Failed to fetch apartment' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data = await request.json();

    if (data.action === 'approve') {
      const apartment = await db.apartment.update({
        where: { id },
        data: {
          status: 'available',
          approvedBy: data.approvedBy || 'developer',
          approvedAt: new Date()
        }
      });
      return NextResponse.json(apartment);
    }

    if (data.action === 'reject') {
      const apartment = await db.apartment.update({
        where: { id },
        data: { status: 'rejected' }
      });
      return NextResponse.json(apartment);
    }

    const finalStatuses = ['sold', 'unavailable', 'rented'];
    const isChangingToFinalStatus = data.status && finalStatuses.includes(data.status);

    const apartment = await db.apartment.update({
      where: { id },
      data: {
        title: data.title,
        price: data.price !== undefined ? parseInt(data.price) : undefined,
        area: data.area,
        bedrooms: data.bedrooms !== undefined ? parseInt(data.bedrooms) : undefined,
        bathrooms: data.bathrooms !== undefined ? parseInt(data.bathrooms) : undefined,
        description: data.description,
        ownerPhone: data.ownerPhone,
        mapLink: data.mapLink,
        imageUrl: data.imageUrl,
        images: data.images ? JSON.stringify(data.images) : undefined,
        videoUrl: data.videoUrl || undefined,
        videos: data.videos ? JSON.stringify(data.videos) : undefined,
        amenities: data.amenities ? JSON.stringify(data.amenities) : undefined,
        featured: data.featured,
        type: data.type,
        status: data.status,
        statusChangedAt: isChangingToFinalStatus ? new Date() : undefined,
        paymentRef: data.paymentRef
      }
    });

    return NextResponse.json(apartment);
  } catch (error) {
    console.error('Error updating apartment:', error);
    return NextResponse.json({ error: 'Failed to update apartment' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // First delete all related payments
    await db.payment.deleteMany({
      where: {
        inquiry: {
          apartmentId: id
        }
      }
    });

    // Then delete all related inquiries
    await db.inquiry.deleteMany({
      where: { apartmentId: id }
    });

    // Finally delete the apartment
    await db.apartment.delete({
      where: { id }
    });

    return NextResponse.json({ success: true, message: 'تم حذف العقار بنجاح' });
  } catch (error: any) {
    console.error('Error deleting apartment:', error);
    return NextResponse.json({ 
      error: 'Failed to delete apartment',
      details: error.message 
    }, { status: 500 });
  }
}

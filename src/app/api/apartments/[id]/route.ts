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
          include: { payment: true }
        }
      }
    });

    if (!apartment) {
      return NextResponse.json({ error: 'Apartment not found' }, { status: 404 });
    }

    // Increment views for approved apartments
    if (apartment.status !== 'pending') {
      await db.apartment.update({
        where: { id },
        data: { views: { increment: 1 } }
      });
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
      videoUrl: apartment.videoUrl,
      videos: apartment.videos ? JSON.parse(apartment.videos) : [],
      amenities: apartment.amenities ? JSON.parse(apartment.amenities) : [],
      featured: apartment.featured,
      type: apartment.type as 'rent' | 'sale',
      status: apartment.status || 'available',
      statusChangedAt: apartment.statusChangedAt?.toISOString(),
      views: apartment.views + 1,
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

    // Handle approval
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

    // Handle rejection
    if (data.action === 'reject') {
      const apartment = await db.apartment.update({
        where: { id },
        data: { status: 'rejected' }
      });
      return NextResponse.json(apartment);
    }

    // Build update data
    const updateData: any = {};
    
    if (data.title !== undefined) updateData.title = data.title;
    if (data.price !== undefined) updateData.price = parseInt(data.price);
    if (data.area !== undefined) updateData.area = data.area;
    if (data.bedrooms !== undefined) updateData.bedrooms = parseInt(data.bedrooms);
    if (data.bathrooms !== undefined) updateData.bathrooms = parseInt(data.bathrooms);
    if (data.description !== undefined) updateData.description = data.description;
    if (data.ownerPhone !== undefined) updateData.ownerPhone = data.ownerPhone;
    if (data.mapLink !== undefined) updateData.mapLink = data.mapLink;
    if (data.imageUrl !== undefined) updateData.imageUrl = data.imageUrl;
    if (data.images !== undefined) updateData.images = JSON.stringify(data.images);
    if (data.videoUrl !== undefined) updateData.videoUrl = data.videoUrl;
    if (data.videos !== undefined) updateData.videos = JSON.stringify(data.videos);
    if (data.amenities !== undefined) updateData.amenities = JSON.stringify(data.amenities);
    if (data.featured !== undefined) updateData.featured = data.featured;
    if (data.type !== undefined) updateData.type = data.type;
    
    // Handle status change
    if (data.status !== undefined) {
      updateData.status = data.status;
      const finalStatuses = ['sold', 'unavailable', 'rented'];
      if (finalStatuses.includes(data.status)) {
        updateData.statusChangedAt = new Date();
      }
    }

    const apartment = await db.apartment.update({
      where: { id },
      data: updateData
    });

    return NextResponse.json(apartment);
  } catch (error: any) {
    console.error('Error updating apartment:', error);
    return NextResponse.json({ 
      error: 'Failed to update apartment',
      details: error.message 
    }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Delete related payments first
    await db.payment.deleteMany({
      where: { inquiry: { apartmentId: id } }
    });

    // Delete related inquiries
    await db.inquiry.deleteMany({
      where: { apartmentId: id }
    });

    // Delete the apartment
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

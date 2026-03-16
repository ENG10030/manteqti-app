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

    // Increment views only for approved apartments
    if (apartment.status !== 'pending') {
      await db.apartment.update({
        where: { id },
        data: { views: { increment: 1 } }
      });
    }

    // Log the view operation
    await db.operationLog.create({
      data: {
        action: 'view',
        entityType: 'apartment',
        entityId: id,
        details: `Viewed: ${apartment.title}`
      }
    });

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

    // Handle approval action
    if (data.action === 'approve') {
      const apartment = await db.apartment.update({
        where: { id },
        data: {
          status: 'available',
          approvedBy: data.approvedBy || 'developer',
          approvedAt: new Date()
        }
      });

      // Log the approval
      await db.operationLog.create({
        data: {
          action: 'approve',
          entityType: 'apartment',
          entityId: id,
          details: `Approved: ${apartment.title}`
        }
      });

      return NextResponse.json(apartment);
    }

    // Handle rejection action
    if (data.action === 'reject') {
      const apartment = await db.apartment.update({
        where: { id },
        data: {
          status: 'rejected'
        }
      });

      // Log the rejection
      await db.operationLog.create({
        data: {
          action: 'reject',
          entityType: 'apartment',
          entityId: id,
          details: `Rejected: ${apartment.title}`
        }
      });

      return NextResponse.json(apartment);
    }

    // Regular update
    // Check if status is changing to a final state (sold, unavailable, rented)
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
        amenities: data.amenities ? JSON.stringify(data.amenities) : undefined,
        featured: data.featured,
        type: data.type,
        status: data.status,
        // Set statusChangedAt when changing to final status
        statusChangedAt: isChangingToFinalStatus ? new Date() : undefined,
        paymentRef: data.paymentRef
      }
    });

    // Log the status change
    if (data.status) {
      await db.operationLog.create({
        data: {
          action: 'status_change',
          entityType: 'apartment',
          entityId: id,
          details: `Status changed to: ${data.status}${isChangingToFinalStatus ? ' (will auto-delete in 48 hours)' : ''}`
        }
      });
    }

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

    // Get apartment info before deletion
    const apartment = await db.apartment.findUnique({
      where: { id }
    });

    // Log the delete operation
    await db.operationLog.create({
      data: {
        action: 'delete',
        entityType: 'apartment',
        entityId: id,
        details: `Deleted: ${apartment?.title || 'Unknown'}`
      }
    });

    await db.apartment.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting apartment:', error);
    return NextResponse.json({ error: 'Failed to delete apartment' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth, requireDeveloper } from '@/lib/auth';

/**
 * GET /api/edit-requests
 * Require developer auth. Return all edit requests.
 */
export async function GET(request: NextRequest) {
  try {
    const decoded = await requireDeveloper(request);
    if (decoded instanceof Response) return decoded;

    const editRequests = await db.editRequest.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        apartment: { select: { id: true, title: true, price: true, status: true, images: true, videos: true, type: true } },
        user: { select: { id: true, name: true, identifier: true } },
      },
    });

    return NextResponse.json(editRequests);
  } catch (error) {
    console.error('Error fetching edit requests:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

/**
 * POST /api/edit-requests
 * Require auth. Create edit request.
 * Body: { apartmentId, userId, editType, newImages?, newVideos?, newPrice?, newStatus?, description? }
 */
export async function POST(request: NextRequest) {
  try {
    const decoded = await verifyAuth(request);
    if (!decoded) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }

    const body = await request.json();
    const { apartmentId, editType, newImages, newVideos, newPrice, newStatus, description } = body;

    if (!apartmentId || !editType) {
      return NextResponse.json({ error: 'معرف العقار ونوع التعديل مطلوبان' }, { status: 400 });
    }

    // Verify apartment exists
    const apartment = await db.apartment.findUnique({
      where: { id: apartmentId },
    });

    if (!apartment) {
      return NextResponse.json({ error: 'العقار غير موجود' }, { status: 404 });
    }

    const editRequest = await db.editRequest.create({
      data: {
        apartmentId,
        userId: decoded.id,
        editType,
        newImages: Array.isArray(newImages) ? JSON.stringify(newImages) : newImages || null,
        newVideos: Array.isArray(newVideos) ? JSON.stringify(newVideos) : newVideos || null,
        newPrice: newPrice ? parseFloat(newPrice) : null,
        newStatus: newStatus || null,
        description: description || null,
        status: 'pending',
      },
      include: {
        apartment: { select: { id: true, title: true } },
        user: { select: { id: true, name: true, identifier: true } },
      },
    });

    // Log edit request creation
    try {
      await db.operationLog.create({
        data: {
          action: 'EDIT_REQUEST_CREATED',
          entityType: 'EditRequest',
          entityId: editRequest.id,
          details: JSON.stringify({
            apartmentId,
            editType,
            requestedBy: decoded.identifier,
          }),
          userId: decoded.id,
        },
      });
    } catch {}

    return NextResponse.json(editRequest, { status: 201 });
  } catch (error) {
    console.error('Error creating edit request:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء إنشاء طلب التعديل' }, { status: 500 });
  }
}

/**
 * PUT /api/edit-requests
 * Require developer auth. Approve or reject edit request.
 * Body: { id, action: 'approve' | 'reject', reviewNotes? }
 */
export async function PUT(request: NextRequest) {
  try {
    const decoded = await requireDeveloper(request);
    if (decoded instanceof Response) return decoded;

    const body = await request.json();
    const { id, action, reviewNotes } = body;

    if (!id || !action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'بيانات غير صحيحة' }, { status: 400 });
    }

    const existingRequest = await db.editRequest.findUnique({
      where: { id },
      include: { apartment: true },
    });

    if (!existingRequest) {
      return NextResponse.json({ error: 'طلب التعديل غير موجود' }, { status: 404 });
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    // Update the edit request
    const editRequest = await db.editRequest.update({
      where: { id },
      data: {
        status: newStatus,
        reviewedBy: decoded.identifier,
        reviewedAt: new Date(),
        reviewNotes: reviewNotes || null,
      },
    });

    // If approved, apply the changes to the apartment
    if (action === 'approve' && existingRequest.apartment) {
      const updateData: Record<string, unknown> = {};

      if (existingRequest.newImages) {
        updateData.images = existingRequest.newImages;
      }
      if (existingRequest.newVideos) {
        updateData.videos = existingRequest.newVideos;
      }
      if (existingRequest.newPrice) {
        updateData.price = existingRequest.newPrice;
      }
      if (existingRequest.newStatus) {
        updateData.status = existingRequest.newStatus;
      }

      if (Object.keys(updateData).length > 0) {
        await db.apartment.update({
          where: { id: existingRequest.apartmentId },
          data: updateData,
        });
      }
    }

    // Log the review action
    try {
      await db.operationLog.create({
        data: {
          action: `EDIT_REQUEST_${action.toUpperCase()}`,
          entityType: 'EditRequest',
          entityId: id,
          details: JSON.stringify({
            apartmentId: existingRequest.apartmentId,
            editType: existingRequest.editType,
            action,
            reviewedBy: decoded.identifier,
            reviewNotes,
          }),
          userId: decoded.id,
        },
      });
    } catch {}

    return NextResponse.json(editRequest);
  } catch (error) {
    console.error('Error updating edit request:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth } from '@/lib/auth';

/**
 * GET /api/likes
 * Return likes. Optionally filter by userId.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    const where: Record<string, unknown> = {};
    if (userId) {
      where.userId = userId;
    }

    const likes = await db.like.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true } },
        apartment: { select: { id: true, title: true } },
      },
    });

    return NextResponse.json(likes);
  } catch (error) {
    console.error('Error fetching likes:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

/**
 * POST /api/likes
 * Require auth. Create a like (favorite).
 * Body: { apartmentId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const decoded = await verifyAuth(request);
    if (!decoded) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }

    const body = await request.json();
    const { apartmentId } = body;

    if (!apartmentId) {
      return NextResponse.json({ error: 'معرف العقار مطلوب' }, { status: 400 });
    }

    // Verify apartment exists
    const apartment = await db.apartment.findUnique({
      where: { id: apartmentId },
    });

    if (!apartment) {
      return NextResponse.json({ error: 'العقار غير موجود' }, { status: 404 });
    }

    // Check if already liked
    const existingLike = await db.like.findUnique({
      where: {
        userId_apartmentId: {
          userId: decoded.id,
          apartmentId,
        },
      },
    });

    if (existingLike) {
      // Unlike: delete existing like
      await db.like.delete({
        where: { id: existingLike.id },
      });
      return NextResponse.json({ success: true, action: 'unliked' });
    }

    // Create like
    const like = await db.like.create({
      data: {
        userId: decoded.id,
        apartmentId,
      },
    });

    return NextResponse.json(like, { status: 201 });
  } catch (error) {
    console.error('Error creating like:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

/**
 * DELETE /api/likes
 * Require auth. Delete a like.
 * Body: { apartmentId: string } or query param ?id=likeId
 */
export async function DELETE(request: NextRequest) {
  try {
    const decoded = await verifyAuth(request);
    if (!decoded) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'معرف الإعجاب مطلوب' }, { status: 400 });
    }

    // Verify the like belongs to the current user (or is developer)
    const existingLike = await db.like.findUnique({
      where: { id },
    });

    if (!existingLike) {
      return NextResponse.json({ error: 'الإعجاب غير موجود' }, { status: 404 });
    }

    if (existingLike.userId !== decoded.id && decoded.role !== 'DEVELOPER') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    }

    await db.like.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting like:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

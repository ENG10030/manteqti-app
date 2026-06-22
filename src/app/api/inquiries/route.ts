import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireApprovedUser, getAuthContext } from '@/lib/auth-middleware';

// Inquiries API

export async function GET(request: NextRequest) {
  try {
    const { auth, errorResponse } = await getAuthContext(request);
    if (errorResponse || !auth) return errorResponse;

    if (auth.role !== 'DEVELOPER') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    }

    const inquiries = await db.inquiry.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        apartment: true,
        payment: true
      }
    });

    return NextResponse.json(inquiries.map(inq => ({
      id: inq.id,
      apartmentId: inq.apartmentId,
      userId: inq.userId,
      name: inq.name,
      email: inq.email,
      phone: inq.phone,
      message: inq.message,
      lifecycleStatus: inq.lifecycleStatus,
      createdAt: inq.createdAt.toISOString(),
      apartment: inq.apartment ? {
        id: inq.apartment.id,
        title: inq.apartment.title,
        price: inq.apartment.price,
        type: inq.apartment.type,
        status: inq.apartment.status
      } : null,
      payment: inq.payment ? {
        id: inq.payment.id,
        status: inq.payment.status,
        method: inq.payment.method
      } : null
    })));
  } catch (error) {
    console.error('Error fetching inquiries:', error);
    return NextResponse.json({ error: 'Failed to fetch inquiries' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { auth, errorResponse } = await requireApprovedUser(request);
    if (errorResponse || !auth) return errorResponse;

    const data = await request.json();

    const inquiry = await db.inquiry.create({
      data: {
        apartmentId: data.apartmentId,
        userId: auth.userId,
        name: data.name,
        email: data.email,
        phone: data.phone,
        message: data.message,
        lifecycleStatus: 'New'
      },
      include: {
        apartment: true
      }
    });

    return NextResponse.json({
      id: inquiry.id,
      apartmentId: inquiry.apartmentId,
      userId: inquiry.userId,
      name: inquiry.name,
      email: inquiry.email,
      phone: inquiry.phone,
      message: inquiry.message,
      lifecycleStatus: inquiry.lifecycleStatus,
      createdAt: inquiry.createdAt.toISOString()
    });
  } catch (error) {
    console.error('Error creating inquiry:', error);
    return NextResponse.json({ error: 'Failed to create inquiry' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';
import { verify } from 'jsonwebtoken';
import { JWT_SECRET } from '@/lib/auth';

export const dynamic = "force-dynamic";

// Toggle contact visibility for an apartment (developer only)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });
    }

    let decoded: any;
    try {
      decoded = verify(token, JWT_SECRET);
    } catch {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }

    if (decoded.role !== 'DEVELOPER') {
      return NextResponse.json({ error: 'غير مصرح - مطور فقط' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { hidden } = body;

    const apartment = await db.apartment.findUnique({
      where: { id },
    });

    if (!apartment) {
      return NextResponse.json({ error: 'العقار غير موجود' }, { status: 404 });
    }

    const updated = await db.apartment.update({
      where: { id },
      data: {
        contactHidden: hidden !== undefined ? hidden : !apartment.contactHidden,
      },
    });

    // If hiding contact, also revert all approved inquiries for this apartment
    if (updated.contactHidden) {
      await db.inquiry.updateMany({
        where: { 
          apartmentId: id,
          lifecycleStatus: 'Contacted'
        },
        data: { lifecycleStatus: 'Revoked' }
      });
    }

    return NextResponse.json({
      success: true,
      contactHidden: updated.contactHidden,
      message: updated.contactHidden ? 'تم إخفاء بيانات التواصل' : 'تم إظهار بيانات التواصل'
    });
  } catch (error) {
    console.error('Toggle contact visibility error:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

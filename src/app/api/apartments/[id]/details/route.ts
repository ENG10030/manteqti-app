import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { isValidId } from '@/lib/auth-middleware';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // ✅ التحقق من صحة المعرف
    if (!isValidId(id)) {
      return NextResponse.json(
        { error: 'معرف غير صالح', code: 'INVALID_ID' },
        { status: 400 }
      );
    }

    const apartment = await db.apartment.findUnique({
      where: { id },
      include: {
        inquiries: {
          orderBy: { createdAt: 'desc' },
          include: {
            payment: true
          }
        }
      }
    });

    if (!apartment) {
      return NextResponse.json(
        { error: 'العقار غير موجود', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // ✅ زيادة عدد المشاهدات
    await db.apartment.update({
      where: { id },
      data: { views: { increment: 1 } }
    });

    // ✅ تسجيل العملية (للمطور)
    try {
      await db.operationLog.create({
        data: {
          action: 'view',
          entityType: 'apartment',
          entityId: id,
          details: JSON.stringify({ title: apartment.title })
        }
      });
    } catch {
      // تجاهل أخطاء التسجيل
    }

    // Check if any inquiry has paid status
    const hasPaidInquiry = apartment.inquiries.some(inq => inq.payment?.status === 'Paid');

    // Transform inquiries with payment info
    const transformedInquiries = apartment.inquiries.map(inq => ({
      id: inq.id,
      apartmentId: inq.apartmentId,
      userId: inq.userId,
      name: inq.name,
      email: inq.email,
      phone: inq.phone,
      message: inq.message,
      lifecycleStatus: inq.lifecycleStatus as 'New' | 'Contacted' | 'Converted' | 'Lost',
      paymentId: inq.payment?.id,
      paymentStatus: inq.payment?.status as 'Paid' | 'Pending' | 'Failed' | undefined,
      method: inq.payment?.method,
      amount: inq.payment?.amount,
      transactionRef: inq.payment?.transactionRef,
      paymentLink: inq.payment?.paymentLink,
      inquiryStatus: inq.payment?.inquiryStatus,
      createdAt: inq.createdAt.toISOString()
    }));

    // Get agreement status from paid inquiry
    const paidInquiry = apartment.inquiries.find(inq => inq.payment?.status === 'Paid');
    const agreementStatus = paidInquiry?.payment?.inquiryStatus === 'Agreement Reached' || 
                            paidInquiry?.payment?.inquiryStatus === 'Contract Signed'
      ? paidInquiry.payment.inquiryStatus as 'Agreement Reached' | 'Contract Signed'
      : null;

    const result = {
      id: apartment.id,
      title: apartment.title,
      price: apartment.price,
      area: apartment.area,
      bedrooms: apartment.bedrooms,
      bathrooms: apartment.bathrooms,
      description: apartment.description,
      ownerPhone: hasPaidInquiry ? apartment.ownerPhone : '',
      mapLink: hasPaidInquiry ? apartment.mapLink : '',
      imageUrl: apartment.imageUrl,
      images: apartment.images ? JSON.parse(apartment.images) : [],
      amenities: apartment.amenities ? JSON.parse(apartment.amenities) : [],
      isFeatured: apartment.isFeatured,
      isVip: apartment.isVip,
      type: apartment.type as 'rent' | 'sale',
      status: apartment.status || 'available',
      views: apartment.views + 1, // إضافة المشاهدة الجديدة
      paymentRef: apartment.paymentRef,
      agreementStatus,
      createdAt: apartment.createdAt.toISOString(),
      inquiries: transformedInquiries
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching apartment details:', error);
    return NextResponse.json(
      { error: 'حدث خطأ في جلب البيانات', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

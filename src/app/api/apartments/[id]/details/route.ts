import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verify } from 'jsonwebtoken';
import { isValidId } from '@/lib/auth-middleware';
import { JWT_SECRET } from '@/lib/auth';



async function getCurrentUser(request: Request) {
  const cookieHeader = request.headers.get("cookie");
  const cookies = new URLSearchParams(cookieHeader?.replace(/; /g, "&") || "");
  const token = cookies.get("auth-token");

  if (!token) return null;

  try {
    const decoded = verify(token, JWT_SECRET) as { userId: string };
    return await db.user.findUnique({
      where: { id: decoded.userId },
    });
  } catch {
    return null;
  }
}

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

    // ✅ Determine auth level of the requester
    const currentUser = await getCurrentUser(request);
    const isDeveloper = currentUser?.role === "DEVELOPER";

    const apartment = await db.apartment.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            phone: isDeveloper ? true : false,
            email: isDeveloper ? true : false,
          },
        },
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

    const isApartmentOwner = currentUser?.id === apartment.createdBy;

    // ✅ زيادة عدد المشاهدات
    await db.apartment.update({
      where: { id },
      data: { views: { increment: 1 } }
    });

    // ✅ PII Protection: Check if the CURRENT user can see contact info
    // Contact is visible when:
    // 1. Contact fee is 0 (free) — visible to everyone
    // 2. User is developer
    // 3. User is apartment owner
    // 4. User has a PAID payment for this apartment
    // 5. User has an inquiry with lifecycleStatus = 'Contacted' (developer approved)
    const currentUserRelevantInquiry = currentUser
      ? apartment.inquiries.find(inq => inq.userId === currentUser.id)
      : null;

    // جلب إعدادات الرسوم
    const settings = await db.settings.findFirst();
    const isContactFree = !settings || settings.contactFee === 0;

    const canSeeOwnerContact = isContactFree
      || isDeveloper
      || isApartmentOwner
      || !!apartment.inquiries.find(
          inq => inq.userId === currentUser?.id &&
          (inq.payment?.status === 'Paid' || inq.lifecycleStatus === 'Contacted')
        );

    // Get agreement status from paid inquiry
    const paidInquiry = apartment.inquiries.find(inq => inq.payment?.status === 'Paid');
    const agreementStatus = paidInquiry?.payment?.inquiryStatus === 'Agreement Reached' ||
                            paidInquiry?.payment?.inquiryStatus === 'Contract Signed'
      ? paidInquiry.payment.inquiryStatus as 'Agreement Reached' | 'Contract Signed'
      : null;

    // ✅ PII Protection: Transform inquiries based on auth level
    const transformedInquiries = apartment.inquiries.map(inq => {
      const isInquiryOwner = currentUser?.id === inq.userId;
      const canSeeInquiryPII = isDeveloper || isApartmentOwner || isInquiryOwner;

      return {
        id: inq.id,
        apartmentId: inq.apartmentId,
        userId: inq.userId,
        name: inq.name,
        email: canSeeInquiryPII ? inq.email : undefined,
        phone: canSeeInquiryPII ? inq.phone : undefined,
        message: inq.message,
        lifecycleStatus: inq.lifecycleStatus as string,
        paymentId: inq.payment?.id,
        paymentStatus: inq.payment?.status as string | undefined,
        method: inq.payment?.method,
        amount: inq.payment?.amount,
        transactionRef: inq.payment?.transactionRef,
        paymentLink: inq.payment?.paymentLink,
        inquiryStatus: inq.payment?.inquiryStatus,
        createdAt: inq.createdAt.toISOString()
      };
    });

    // User's inquiry status for this apartment
    const userInquiryStatus = currentUserRelevantInquiry
      ? {
          id: currentUserRelevantInquiry.id,
          lifecycleStatus: currentUserRelevantInquiry.lifecycleStatus,
          paymentStatus: currentUserRelevantInquiry.payment?.status || null,
          hasPayment: !!currentUserRelevantInquiry.payment,
        }
      : null;

    const result = {
      id: apartment.id,
      title: apartment.title,
      price: apartment.price,
      area: apartment.area,
      bedrooms: apartment.bedrooms,
      bathrooms: apartment.bathrooms,
      description: apartment.description,
      // PII: only show ownerPhone if user can see contact
      ownerPhone: canSeeOwnerContact ? apartment.ownerPhone : '',
      // PII: only show mapLink if user can see contact
      mapLink: canSeeOwnerContact ? (apartment.mapLink || '') : '',
      imageUrl: apartment.imageUrl,
      images: apartment.images ? JSON.parse(apartment.images) : [],
      amenities: apartment.amenities ? JSON.parse(apartment.amenities) : [],
      isFeatured: apartment.isFeatured,
      type: apartment.type as 'rent' | 'sale',
      status: apartment.status || 'available',
      views: apartment.views + 1,
      paymentRef: apartment.paymentRef,
      agreementStatus,
      createdAt: apartment.createdAt.toISOString(),
      // Contact visibility flag
      contactRevealed: canSeeOwnerContact,
      // User's inquiry status
      userInquiryStatus,
      // Apartment owner basic info
      user: isDeveloper
        ? apartment.user
        : { id: apartment.user?.id, name: apartment.user?.name || 'غير معروف' },
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

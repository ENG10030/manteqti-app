import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';
import { verify } from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || "manteqti-secret-key-2024";

// جلب طلبات التعديل
export async function GET(request: NextRequest) {
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
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const userId = searchParams.get('userId');
    const apartmentId = searchParams.get('apartmentId');

    const where: Record<string, unknown> = {};

    if (status) where.status = status;
    if (userId) where.userId = userId;
    if (apartmentId) where.apartmentId = apartmentId;

    const editRequests = await db.propertyEditRequest.findMany({
      where,
      include: {
        apartment: {
          select: {
            id: true,
            title: true,
            price: true,
            status: true,
            images: true,
            videos: true,
            type: true,
            area: true,
            bedrooms: true,
            bathrooms: true,
            description: true,
            ownerPhone: true,
          }
        },
        user: {
          select: {
            id: true,
            name: true,
            identifier: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(editRequests);
  } catch (error) {
    console.error('Error fetching edit requests:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

// إنشاء طلب تعديل جديد - يدعم كل حقول العقار
export async function POST(request: NextRequest) {
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

    const tokenUserId = decoded.userId;
    const body = await request.json();

    // التحقق من وجود العقار
    const apartment = await db.apartment.findUnique({
      where: { id: body.apartmentId },
    });

    if (!apartment) {
      return NextResponse.json({ error: 'العقار غير موجود' }, { status: 404 });
    }

    // التحقق من أن المستخدم هو صاحب العقار أو مطور
    if (apartment.createdBy !== tokenUserId && decoded.role !== 'DEVELOPER') {
      return NextResponse.json({ error: 'غير مصرح لك بتعديل هذا العقار' }, { status: 403 });
    }

    // المطور يعدل مباشرة بدون طلب
    if (decoded.role === 'DEVELOPER') {
      const updateData: Record<string, unknown> = {};
      
      if (body.title !== undefined) updateData.title = body.title;
      if (body.price !== undefined) updateData.price = parseInt(body.price);
      if (body.area !== undefined) updateData.area = body.area;
      if (body.bedrooms !== undefined) updateData.bedrooms = parseInt(body.bedrooms);
      if (body.bathrooms !== undefined) updateData.bathrooms = parseInt(body.bathrooms);
      if (body.floor !== undefined) updateData.floor = body.floor ? parseInt(body.floor) : null;
      if (body.apartmentSize !== undefined) updateData.apartmentSize = body.apartmentSize ? parseInt(body.apartmentSize) : null;
      if (body.description !== undefined) updateData.description = body.description;
      if (body.ownerPhone !== undefined) updateData.ownerPhone = body.ownerPhone;
      if (body.mapLink !== undefined) updateData.mapLink = body.mapLink;
      if (body.type !== undefined) updateData.type = body.type;
      if (body.status !== undefined) updateData.status = body.status;
      if (body.images !== undefined) updateData.images = body.images;
      if (body.videos !== undefined) updateData.videos = body.videos;

      if (Object.keys(updateData).length > 0) {
        await db.apartment.update({
          where: { id: body.apartmentId },
          data: updateData,
        });
      }

      return NextResponse.json({
        success: true,
        message: 'تم تحديث العقار بنجاح',
        directUpdate: true,
      });
    }

    // التحقق من أن العقار منشور
    if (apartment.status !== 'available' && apartment.status !== 'reserved') {
      return NextResponse.json({ error: 'لا يمكن طلب تعديل على عقار غير منشور' }, { status: 400 });
    }

    // التحقق من عدم وجود طلب تعديل معلق سابق
    const existingRequest = await db.propertyEditRequest.findFirst({
      where: {
        apartmentId: body.apartmentId,
        userId: tokenUserId,
        status: 'pending',
      },
    });

    if (existingRequest) {
      return NextResponse.json({ error: 'يوجد طلب تعديل معلق بالفعل على هذا العقار' }, { status: 400 });
    }

    // تجهيز التعديلات المطلوبة
    const changes: Record<string, unknown> = {};
    const fieldLabels: string[] = [];

    if (body.title !== undefined && body.title !== apartment.title) { changes.title = body.title; fieldLabels.push('العنوان'); }
    if (body.price !== undefined && parseInt(body.price) !== apartment.price) { changes.price = parseInt(body.price); fieldLabels.push('السعر'); }
    if (body.area !== undefined && body.area !== apartment.area) { changes.area = body.area; fieldLabels.push('المنطقة'); }
    if (body.bedrooms !== undefined && parseInt(body.bedrooms) !== apartment.bedrooms) { changes.bedrooms = parseInt(body.bedrooms); fieldLabels.push('غرف النوم'); }
    if (body.bathrooms !== undefined && parseInt(body.bathrooms) !== apartment.bathrooms) { changes.bathrooms = parseInt(body.bathrooms); fieldLabels.push('الحمامات'); }
    if (body.floor !== undefined && (body.floor ? parseInt(body.floor) : null) !== apartment.floor) { changes.floor = body.floor ? parseInt(body.floor) : null; fieldLabels.push('الدور'); }
    if (body.apartmentSize !== undefined && (body.apartmentSize ? parseInt(body.apartmentSize) : null) !== apartment.apartmentSize) { changes.apartmentSize = body.apartmentSize ? parseInt(body.apartmentSize) : null; fieldLabels.push('المساحة'); }
    if (body.description !== undefined && body.description !== apartment.description) { changes.description = body.description; fieldLabels.push('الوصف'); }
    if (body.ownerPhone !== undefined && body.ownerPhone !== apartment.ownerPhone) { changes.ownerPhone = body.ownerPhone; fieldLabels.push('رقم الهاتف'); }
    if (body.mapLink !== undefined && body.mapLink !== apartment.mapLink) { changes.mapLink = body.mapLink; fieldLabels.push('رابط الخريطة'); }
    if (body.type !== undefined && body.type !== apartment.type) { changes.type = body.type; fieldLabels.push('النوع'); }
    
    // الصور والفيديوهات
    const newImages = body.images !== undefined ? body.images : null;
    const newVideos = body.videos !== undefined ? body.videos : null;
    
    if (newImages !== null) {
      changes.images = newImages;
      fieldLabels.push('الصور');
    }
    if (newVideos !== null) {
      changes.videos = newVideos;
      fieldLabels.push('الفيديوهات');
    }

    if (Object.keys(changes).length === 0) {
      return NextResponse.json({ error: 'لم تقم بأي تعديل' }, { status: 400 });
    }

    // تحديد نوع التعديل
    let editType = 'multiple';
    if (fieldLabels.length === 1) {
      if (changes.images !== undefined) editType = 'images';
      else if (changes.videos !== undefined) editType = 'videos';
      else if (changes.price !== undefined) editType = 'price';
      else editType = 'update';
    }

    const editRequest = await db.propertyEditRequest.create({
      data: {
        apartmentId: body.apartmentId,
        userId: tokenUserId,
        editType,
        changes: JSON.stringify(changes),
        // حقول محددة للتوافق
        newImages: changes.images ? (typeof changes.images === 'string' ? changes.images : JSON.stringify(changes.images)) : null,
        newVideos: changes.videos ? (typeof changes.videos === 'string' ? changes.videos : JSON.stringify(changes.videos)) : null,
        newPrice: changes.price ? (changes.price as number) : null,
        newStatus: changes.status ? (changes.status as string) : null,
        description: `طلب تعديل: ${fieldLabels.join(', ')}${body.description ? '\n' + body.description : ''}`,
        status: 'pending',
      },
      include: {
        apartment: {
          select: {
            id: true,
            title: true,
          }
        },
        user: {
          select: {
            id: true,
            name: true,
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      editRequest,
      message: 'تم إرسال طلب التعديل بنجاح. سيتم مراجعته من قبل المطور.'
    });
  } catch (error) {
    console.error('Error creating edit request:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء إرسال طلب التعديل' }, { status: 500 });
  }
}

// حذف طلب تعديل أو حذف طلبات التعديل
export async function DELETE(request: NextRequest) {
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
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const clearAll = searchParams.get('clearAll');

    if (id) {
      await db.propertyEditRequest.delete({ where: { id } });
    } else if (clearAll === 'true') {
      await db.propertyEditRequest.deleteMany({});
    } else {
      await db.propertyEditRequest.deleteMany({ where: { status: 'pending' } });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting edit requests:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

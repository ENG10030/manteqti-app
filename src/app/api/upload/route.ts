import { NextRequest, NextResponse } from 'next/server';
import { uploadImage, uploadVideo, ALLOWED_IMAGE_TYPES, ALLOWED_VIDEO_TYPES, MAX_FILE_SIZE } from '@/lib/cloudinary';
import { cookies } from 'next/headers';
import { verify } from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || "manteqti-secret-key-2024";

export async function POST(request: NextRequest) {
  try {
    // التحقق من تسجيل الدخول
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const type = (formData.get('type') as string) || 'image';

    if (!file) {
      return NextResponse.json({ error: 'لم يتم إرسال ملف' }, { status: 400 });
    }

    // التحقق من نوع الملف
    const allowedTypes = type === 'video' ? ALLOWED_VIDEO_TYPES : ALLOWED_IMAGE_TYPES;
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({
        error: `نوع الملف غير مدعوم. الأنواع المسموحة: ${allowedTypes.join(', ')}`
      }, { status: 400 });
    }

    // التحقق من حجم الملف
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({
        error: 'حجم الملف أكبر من الحد المسموح (50MB)'
      }, { status: 400 });
    }

    // قراءة الملف
    const buffer = Buffer.from(await file.arrayBuffer());

    // رفع الملف
    let result: { url: string; publicId: string };
    if (type === 'video') {
      result = await uploadVideo(buffer);
    } else {
      result = await uploadImage(buffer);
    }

    return NextResponse.json({
      url: result.url,
      publicId: result.publicId,
      type: file.type,
      size: file.size,
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({
      error: 'حدث خطأ أثناء رفع الملف',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { uploadImage, uploadVideo, ALLOWED_IMAGE_TYPES, ALLOWED_VIDEO_TYPES, MAX_FILE_SIZE } from '@/lib/cloudinary';
import { JWT_SECRET } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // CRITICAL FIX: Actually verify the JWT token (was reading but never verifying before!)
    const { cookies } = await import('next/headers');
    const { verify } = await import('jsonwebtoken');
    
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });
    }

    // CRITICAL FIX: Verify token — no hardcoded fallback secret
    let decoded: any;
    try {
      decoded = verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    } catch {
      return NextResponse.json({ error: 'انتهت صلاحية الجلسة' }, { status: 401 });
    }

    if (!decoded.userId) {
      return NextResponse.json({ error: 'رمز غير صالح' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const type = (formData.get('type') as string) || 'image';

    if (!file) {
      return NextResponse.json({ error: 'لم يتم إرسال ملف' }, { status: 400 });
    }

    const allowedTypes = type === 'video' ? ALLOWED_VIDEO_TYPES : ALLOWED_IMAGE_TYPES;
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({
        error: `نوع الملف غير مدعوم. الأنواع المسموحة: ${allowedTypes.join(', ')}`
      }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({
        error: 'حجم الملف أكبر من الحد المسموح (50MB)'
      }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

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
    // FIX: Don't expose internal error details
    return NextResponse.json({
      error: 'حدث خطأ أثناء رفع الملف'
    }, { status: 500 });
  }
}

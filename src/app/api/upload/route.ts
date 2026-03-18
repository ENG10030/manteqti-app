import { NextRequest, NextResponse } from 'next/server';
import { uploadImage, uploadVideo, ALLOWED_IMAGE_TYPES, ALLOWED_VIDEO_TYPES, MAX_FILE_SIZE } from '@/lib/cloudinary';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const type = formData.get('type') as 'image' | 'video' | null;

    if (!file) {
      return NextResponse.json({ error: 'لم يتم إرسال ملف' }, { status: 400 });
    }

    // التحقق من حجم الملف
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'حجم الملف يتجاوز الحد المسموح (50MB)' }, { status: 400 });
    }

    // التحقق من نوع الملف
    const isImage = ALLOWED_IMAGE_TYPES.includes(file.type);
    const isVideo = ALLOWED_VIDEO_TYPES.includes(file.type);

    if (!isImage && !isVideo) {
      return NextResponse.json({ 
        error: 'نوع الملف غير مدعوم',
        supported: {
          images: ALLOWED_IMAGE_TYPES,
          videos: ALLOWED_VIDEO_TYPES
        }
      }, { status: 400 });
    }

    // تحويل الملف إلى Buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // رفع الملف
    let result;
    if (type === 'video' || isVideo) {
      result = await uploadVideo(buffer);
    } else {
      result = await uploadImage(buffer);
    }

    return NextResponse.json({
      success: true,
      url: result.url,
      publicId: result.publicId,
      originalName: file.name,
      size: file.size,
      type: file.type,
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ 
      error: 'حدث خطأ أثناء رفع الملف',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// رفع عدة ملفات
export async function PUT(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const type = formData.get('type') as 'image' | 'video' | null;

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'لم يتم إرسال ملفات' }, { status: 400 });
    }

    const results: { url: string; publicId: string; originalName: string }[] = [];

    for (const file of files) {
      // التحقق من حجم الملف
      if (file.size > MAX_FILE_SIZE) {
        continue;
      }

      // التحقق من نوع الملف
      const isImage = ALLOWED_IMAGE_TYPES.includes(file.type);
      const isVideo = ALLOWED_VIDEO_TYPES.includes(file.type);

      if (!isImage && !isVideo) {
        continue;
      }

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      let result;
      if (type === 'video' || isVideo) {
        result = await uploadVideo(buffer);
      } else {
        result = await uploadImage(buffer);
      }

      results.push({
        url: result.url,
        publicId: result.publicId,
        originalName: file.name,
      });
    }

    return NextResponse.json({
      success: true,
      files: results,
      count: results.length,
    });

  } catch (error) {
    console.error('Batch upload error:', error);
    return NextResponse.json({ 
      error: 'حدث خطأ أثناء رفع الملفات' 
    }, { status: 500 });
  }
}

// دعم GET للاختبار
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Upload API يعمل بشكل صحيح',
    config: {
      maxFileSize: '50MB',
      allowedImages: ALLOWED_IMAGE_TYPES,
      allowedVideos: ALLOWED_VIDEO_TYPES,
    }
  });
}

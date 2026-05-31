import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { cookies } from 'next/headers';
import { verify } from 'jsonwebtoken';

export const dynamic = "force-dynamic";

const JWT_SECRET = process.env.JWT_SECRET;

// 🔒 التحقق من أن الطلب من مطور
async function verifyDeveloper(): Promise<boolean> {
  if (!JWT_SECRET) return false;
  
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;
    if (!token) return false;
    
    const decoded = verify(token, JWT_SECRET) as unknown as { role?: string };
    return decoded.role === 'DEVELOPER';
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  // 🔒 الأمان: فقط المطور يمكنه تحميل ملف ZIP المشروع
  if (!(await verifyDeveloper())) {
    return NextResponse.json({ error: 'غير مصرح - هذه العملية مخصصة للمطور فقط' }, { status: 403 });
  }

  const isBase64 = request.nextUrl.searchParams.get('base64') === 'true';
  
  // أمان المسار: لا نسمح بتحديد مسار مخصص
  const safeFileName = 'manteqti-v70.zip';
  const zipPath = path.join(process.cwd(), 'public', safeFileName);

  try {
    const fileBuffer = await fs.readFile(zipPath);

    if (isBase64) {
      const base64 = fileBuffer.toString('base64');
      return new NextResponse(base64, {
        headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-cache, no-store' }
      });
    }

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${safeFileName}"`,
        'Content-Length': fileBuffer.length.toString(),
        'Cache-Control': 'no-cache, no-store'
      }
    });
  } catch (error) {
    return NextResponse.json({ error: 'ZIP file not found' }, { status: 404 });
  }
}

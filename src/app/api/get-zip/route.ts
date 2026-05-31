import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { cookies } from 'next/headers';
import { verify } from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || "manteqti-secret-key-2024";
const DEVELOPER_EMAIL = process.env.DEVELOPER_EMAIL || "ahmadmamdouh10030@gmail.com";

// 🔒 SECURITY FIX: Developer-only access to prevent unauthorized downloads
async function requireDeveloper(request: NextRequest): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;
  if (!token) return false;

  try {
    const decoded = verify(token, JWT_SECRET) as { userId: string; role?: string; identifier?: string };
    if (decoded.role === "DEVELOPER" || decoded.identifier === DEVELOPER_EMAIL) return true;
    return false;
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  // 🔒 SECURITY FIX: Require developer authentication
  if (!(await requireDeveloper(request))) {
    return NextResponse.json({ error: 'غير مصرح - هذه النقطة متاحة للمطور فقط' }, { status: 403 });
  }

  const isBase64 = request.nextUrl.searchParams.get('base64') === 'true';
  
  const zipPath = path.join(process.cwd(), 'public', 'manteqti-final-v43.zip');

  try {
    const fileBuffer = await fs.readFile(zipPath);

    if (isBase64) {
      const base64 = fileBuffer.toString('base64');
      return new NextResponse(base64, {
        headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-cache' }
      });
    }

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="manteqti-final-v43.zip"',
        'Content-Length': fileBuffer.length.toString(),
        'Cache-Control': 'no-cache'
      }
    });
  } catch (error) {
    return NextResponse.json({ error: 'ZIP file not found' }, { status: 500 });
  }
}

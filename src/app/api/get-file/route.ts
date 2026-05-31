import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { verify } from 'jsonwebtoken';
import { db } from '@/lib/db';

const JWT_SECRET = process.env.JWT_SECRET || "manteqti-secret-key-2024";
const DEVELOPER_EMAIL = process.env.DEVELOPER_EMAIL || 'ahmadmamdouh10030@gmail.com';

async function isDeveloper(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get('auth-token')?.value;
  if (!token) return false;
  try {
    const decoded = verify(token, JWT_SECRET) as { userId?: string; role?: string; identifier?: string };
    if (decoded.role === 'DEVELOPER' || decoded.identifier === DEVELOPER_EMAIL) return true;
    if (decoded.userId) {
      const user = await db.user.findUnique({ where: { id: decoded.userId }, select: { role: true, identifier: true } });
      return user?.role === 'DEVELOPER' || user?.identifier === DEVELOPER_EMAIL;
    }
    return false;
  } catch {
    return false;
  }
}

const fileMap: Record<string, string> = {
  'realtime': 'src/lib/realtime.ts',
  'apartments': 'src/app/api/apartments/[id]/route.ts',
  'settings': 'src/app/api/settings/route.ts',
  'payments': 'src/app/api/payments/route.ts',
  'payments-id': 'src/app/api/payments/[id]/route.ts',
  'schema': 'prisma/schema.prisma',
  'page': 'src/app/page.tsx.backup', // Original app code (not the download page)
  'fileupload': 'src/components/file-upload.tsx',
};

export async function GET(request: NextRequest) {
  // Auth check: only developers can access source files
  const dev = await isDeveloper(request);
  if (!dev) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  }

  const searchParams = request.nextUrl.searchParams;
  const fileKey = searchParams.get('file') || '';
  const filePath = fileMap[fileKey];

  if (!filePath) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  try {
    const fullPath = path.join(process.cwd(), filePath);
    const content = await fs.readFile(fullPath, 'utf-8');

    return new NextResponse(content, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
      }
    });
  } catch (error) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
}

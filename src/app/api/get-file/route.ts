import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

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
  const searchParams = request.nextUrl.searchParams;
  const fileKey = searchParams.get('file') || '';
  const filePath = fileMap[fileKey];

  if (!filePath) {
    return NextResponse.json({ error: 'File not found', available: Object.keys(fileMap) }, { status: 404 });
  }

  try {
    const fullPath = path.join(process.cwd(), filePath);
    const content = await fs.readFile(fullPath, 'utf-8');

    return new NextResponse(content, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*',
      }
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to read file: ' + filePath }, { status: 500 });
  }
}

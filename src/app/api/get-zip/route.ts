import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
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

import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";

const FILE_MAP: Record<string, string> = {
  'page.tsx': 'src/app/page.tsx',
  'login-route.ts': 'src/app/api/auth/login/route.ts',
  'verify-otp-route.ts': 'src/app/api/auth/verify-otp/route.ts',
  'register-route.ts': 'src/app/api/auth/register/route.ts',
  'request-otp-route.ts': 'src/app/api/auth/request-otp/route.ts',
  'forgot-password-route.ts': 'src/app/api/auth/forgot-password/route.ts',
  'users-route.ts': 'src/app/api/users/route.ts',
  'delete-user-route.ts': 'src/app/api/users/[id]/delete/route.ts',
  'block-user-route.ts': 'src/app/api/users/[id]/block/route.ts',
  'approve-user-route.ts': 'src/app/api/users/[id]/approve/route.ts',
  'realtime-service.ts': 'mini-services/realtime-service/index.ts',
  'lib-realtime.ts': 'src/lib/realtime.ts',
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fileKey = searchParams.get('file');
    const isRaw = searchParams.get('raw') === 'true';

    if (!fileKey) {
      return NextResponse.json({ error: 'Missing file parameter' }, { status: 400 });
    }

    // If it's the zip file
    if (fileKey.endsWith('.zip')) {
      const zipPath = join(process.cwd(), 'public', fileKey);
      const fs = await import('fs/promises');
      const buffer = await fs.readFile(zipPath);
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="${fileKey}"`,
        },
      });
    }

    const filePath = FILE_MAP[fileKey];
    if (!filePath) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const fullPath = join(process.cwd(), filePath);
    const content = await readFile(fullPath, 'utf-8');

    if (isRaw) {
      return new NextResponse(content, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-cache',
        },
      });
    }

    return new NextResponse(content, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${fileKey}"`,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('Download error:', error);
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
}

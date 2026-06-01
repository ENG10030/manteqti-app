import { NextRequest, NextResponse } from 'next/server';
import { requireDeveloper } from '@/lib/auth-middleware';

export async function GET(request: NextRequest) {
  // SECURITY: Require developer authentication
  const { auth, errorResponse } = await requireDeveloper(request);
  if (errorResponse || !auth) return errorResponse!;

  // SECURITY: Source code download disabled in production
  return NextResponse.json({
    error: 'هذا المسار غير متاح. تحميل الكود المصدري معطل لأسباب أمنية'
  }, { status: 403 });
}

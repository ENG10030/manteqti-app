// ⛔ SECURITY: This endpoint has been DISABLED.
// Serving source code and ZIP files publicly is a security risk.
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    { error: 'Not found' },
    { status: 404 }
  );
}
import { NextResponse } from 'next/server';

// This endpoint is DEPRECATED and BLOCKED.
// Developer login now uses the regular /api/auth/login endpoint.
// The developer account is identified by email matching DEVELOPER_EMAIL env variable.
export async function POST() {
  return NextResponse.json(
    { error: 'This endpoint has been disabled. Please use the regular login.' },
    { status: 403 }
  );
}

export async function GET() {
  return NextResponse.json(
    { error: 'This endpoint has been disabled.' },
    { status: 403 }
  );
}

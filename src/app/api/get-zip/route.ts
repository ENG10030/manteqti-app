import { NextRequest, NextResponse } from 'next/server';
import { requireDeveloper } from '@/lib/auth';

/**
 * GET /api/get-zip
 * SECURITY FIX: This route was previously unprotected and exposed ZIP files without auth.
 * Now requires developer authentication.
 * 
 * ⚠️ If you don't need this route, DELETE the entire get-zip directory from your project.
 */
export async function GET(request: NextRequest) {
  const decoded = await requireDeveloper(request);
  if (decoded instanceof Response) return decoded;

  return NextResponse.json({ 
    error: 'This endpoint has been secured. If not needed, delete the get-zip directory from src/app/api/' 
  }, { status: 403 });
}

// Block all other methods
export async function POST() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}
export async function PUT() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}
export async function DELETE() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

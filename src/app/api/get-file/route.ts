import { NextRequest, NextResponse } from 'next/server';
import { requireDeveloper } from '@/lib/auth';

/**
 * GET /api/get-file
 * SECURITY FIX: This route was previously unprotected and exposed files without auth.
 * Now requires developer authentication.
 * 
 * ⚠️ If you don't need this route, DELETE the entire get-file directory from your project.
 */
export async function GET(request: NextRequest) {
  const decoded = await requireDeveloper(request);
  if (decoded instanceof Response) return decoded;

  const { searchParams } = new URL(request.url);
  const file = searchParams.get('file');

  if (!file) {
    return NextResponse.json({ error: 'File parameter required' }, { status: 400 });
  }

  // Prevent directory traversal attacks
  const normalizedPath = file.replace(/\.\./g, '').replace(/\//g, '');
  
  return NextResponse.json({ 
    error: 'This endpoint has been secured. If not needed, delete the get-file directory from src/app/api/' 
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

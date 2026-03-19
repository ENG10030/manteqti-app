import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    // Get token from cookie or header
    const cookieToken = request.cookies.get('auth_token')?.value;
    const authHeader = request.headers.get('authorization');
    const headerToken = authHeader?.replace('Bearer ', '');
    const token = cookieToken || headerToken;

    // Delete session from database if token exists
    if (token) {
      try {
        await db.session.deleteMany({
          where: { token }
        });
      } catch {
        // Ignore errors
      }
    }

    // Create response and clear cookie
    const response = NextResponse.json({ 
      success: true,
      message: 'تم تسجيل الخروج بنجاح'
    });
    
    response.cookies.delete('auth_token');
    
    return response;
  } catch (error) {
    console.error('Error logging out:', error);
    
    // Still try to clear cookie
    const response = NextResponse.json({ success: true });
    response.cookies.delete('auth_token');
    return response;
  }
}

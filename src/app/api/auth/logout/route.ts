import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    // Get session token from cookie
    const token = request.cookies.get('session_token')?.value;

    if (token) {
      // Delete session from database
      try {
        await db.session.delete({ where: { token } });
      } catch {
        // Session might not exist, ignore error
      }
    }

    // Create response and clear cookie
    const response = NextResponse.json({
      success: true,
      message: 'تم تسجيل الخروج'
    });

    response.cookies.delete('session_token');

    return response;
  } catch (error) {
    console.error('Logout error:', error);
    
    // Still try to clear cookie on error
    const response = NextResponse.json({
      success: true,
      message: 'تم تسجيل الخروج'
    });
    response.cookies.delete('session_token');
    return response;
  }
}

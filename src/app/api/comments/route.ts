import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';
import { verify } from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || "manteqti-secret-key-2024";

// Helper: get authenticated user from token
async function getAuthUser(request: NextRequest): Promise<{ userId: string; role: string } | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;
    if (!token) return null;
    
    const decoded = verify(token, JWT_SECRET) as { userId: string; role: string };
    return { userId: decoded.userId, role: decoded.role || 'USER' };
  } catch {
    return null;
  }
}

// جلب التعليقات
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const apartmentId = searchParams.get('apartmentId');
    const status = searchParams.get('status');
    const userId = searchParams.get('userId');

    const where: Record<string, unknown> = {};
    if (apartmentId) where.apartmentId = apartmentId;
    if (status) where.status = status;
    if (userId) where.userId = userId;

    const comments = await db.comment.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            // Don't expose email/identifier in public comments
          }
        },
        apartment: {
          select: {
            id: true,
            title: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(comments);
  } catch (error) {
    console.error('Error fetching comments:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

// إضافة تعليق جديد - يتطلب تسجيل الدخول
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthUser(request);
    
    // ✅ Require authentication for commenting
    if (!auth) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول لإضافة تعليق' }, { status: 401 });
    }

    const body = await request.json();
    const { apartmentId, content } = body;

    if (!apartmentId || !content) {
      return NextResponse.json({ error: 'بيانات ناقصة' }, { status: 400 });
    }

    // ✅ Sanitize: Strip HTML tags to prevent XSS
    const sanitizedContent = content.replace(/<[^>]*>/g, '').trim();

    // Validate comment length
    if (sanitizedContent.length < 2) {
      return NextResponse.json({ error: 'التعليق قصير جداً' }, { status: 400 });
    }
    if (sanitizedContent.length > 1000) {
      return NextResponse.json({ error: 'التعليق طويل جداً (الحد الأقصى 1000 حرف)' }, { status: 400 });
    }

    // Verify apartment exists
    const apartment = await db.apartment.findUnique({
      where: { id: apartmentId },
    });

    if (!apartment) {
      return NextResponse.json({ error: 'العقار غير موجود' }, { status: 404 });
    }

    // Check if user is blocked
    const user = await db.user.findUnique({
      where: { id: auth.userId },
      select: { isBlocked: true },
    });

    if (user?.isBlocked) {
      return NextResponse.json({ error: 'تم حظر حسابك' }, { status: 403 });
    }

    const isDeveloper = auth.role === 'DEVELOPER';

    const comment = await db.comment.create({
      data: {
        apartmentId,
        // ✅ Use token userId, not body userId
        userId: auth.userId,
        content: sanitizedContent,
        status: isDeveloper ? 'approved' : 'pending',
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          }
        }
      }
    });

    return NextResponse.json({ 
      success: true, 
      comment,
      message: isDeveloper ? 'تم نشر التعليق مباشرة' : 'تم إرسال تعليقك وهو في انتظار موافقة المطور' 
    });
  } catch (error) {
    console.error('Error creating comment:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

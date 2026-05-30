import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';
import { verify } from 'jsonwebtoken';
import { requireApprovedUser } from '@/lib/auth-middleware';

const JWT_SECRET = process.env.JWT_SECRET || "manteqti-secret-key-2024";

// جلب التعليقات
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const apartmentId = searchParams.get('apartmentId');
    const status = searchParams.get('status');
    const userId = searchParams.get('userId');
    const currentUserId = searchParams.get('currentUserId');

    // If fetching for a specific apartment (public view)
    if (apartmentId) {
      const where: Record<string, unknown> = {
        apartmentId,
        // Show approved comments OR user's own pending comments
        OR: [
          { status: 'approved' },
        ],
      };

      // If currentUserId provided, also include their own pending comments
      if (currentUserId) {
        where.OR = [
          { status: 'approved' },
          { status: 'pending', userId: currentUserId },
        ];
      }

      const comments = await db.comment.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              identifier: true,
            }
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return NextResponse.json(comments);
    }

    // General fetch (dev dashboard) — return all comments
    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (userId) where.userId = userId;

    const comments = await db.comment.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            identifier: true,
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

// إضافة تعليق جديد
export async function POST(request: NextRequest) {
  try {
    const { auth, errorResponse } = await requireApprovedUser(request);
    if (errorResponse || !auth) return errorResponse!;

    const body = await request.json();
    const { apartmentId, content } = body;

    if (!apartmentId || !content) {
      return NextResponse.json({ error: 'بيانات ناقصة' }, { status: 400 });
    }

    const isDeveloper = auth.role === 'DEVELOPER';
    const userId = auth.userId;

    const comment = await db.comment.create({
      data: {
        apartmentId,
        userId,
        content,
        status: isDeveloper ? 'approved' : 'pending',
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            identifier: true,
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

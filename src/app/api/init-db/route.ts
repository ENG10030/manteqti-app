import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';

// Setup key for first-time initialization (no auth needed)
// After setup, this endpoint requires developer auth
const SETUP_KEY = process.env.INIT_SETUP_KEY || "manteqti-setup-2024";
const JWT_SECRET = process.env.JWT_SECRET || "manteqti-secret-key-2024";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const setupKey = searchParams.get('setupKey');

    // Check if any developer user already exists
    const existingDeveloper = await db.user.findFirst({
      where: { role: 'DEVELOPER' }
    });

    if (existingDeveloper) {
      return NextResponse.json({
        message: 'قاعدة البيانات تمت تهيئتها مسبقاً',
        initialized: true,
        developer: {
          id: existingDeveloper.id,
          email: existingDeveloper.identifier,
          name: existingDeveloper.name,
        }
      });
    }

    // No developer exists - allow setup with key
    if (!setupKey || setupKey !== SETUP_KEY) {
      return NextResponse.json({
        error: 'مفتاح التهيئة غير صحيح',
        hint: 'أضف ?setupKey=manteqti-setup-2024 للرابط'
      }, { status: 401 });
    }

    const DEVELOPER_EMAIL = process.env.DEVELOPER_EMAIL || 'ahmadmamdouh10030@gmail.com';
    const DEVELOPER_PASSWORD = process.env.DEVELOPER_PASSWORD || 'admin123';

    // Create developer user
    const hashedPassword = await bcrypt.hash(DEVELOPER_PASSWORD, 10);
    const developer = await db.user.create({
      data: {
        email: DEVELOPER_EMAIL,
        identifier: DEVELOPER_EMAIL,
        name: 'المطور - أحمد',
        phone: '+201234567890',
        password: hashedPassword,
        role: 'DEVELOPER',
        isApproved: true,
        emailVerified: true,
      }
    });

    // Create default settings if not exists
    const existingSettings = await db.settings.findFirst();
    if (!existingSettings) {
      await db.settings.create({
        data: {
          contactFee: 50,
          featuredFee: 100,
          premiumFee: 200,
          saleDisplayFee: 100,
          rentDisplayFee: 75,
          otherServicesFee: 50,
          highlightFee: 150,
          priorityListingFee: 200,
          verifiedListingFee: 250,
          currency: 'ج.م',
        }
      });
    }

    return NextResponse.json({
      success: true,
      message: 'تم تهيئة قاعدة البيانات بنجاح! يمكنك الآن الدخول كمطور.',
      developer: {
        id: developer.id,
        email: DEVELOPER_EMAIL,
      },
      loginCredentials: {
        email: DEVELOPER_EMAIL,
        password: 'admin123',
      }
    });

  } catch (error) {
    console.error('Init error:', error);
    return NextResponse.json({
      error: 'حدث خطأ أثناء التهيئة',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

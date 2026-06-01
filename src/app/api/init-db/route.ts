import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { requireDeveloper } from '@/lib/auth-middleware';

export async function GET(request: NextRequest) {
  // SECURITY: Require developer authentication
  const { auth, errorResponse } = await requireDeveloper(request);
  if (errorResponse || !auth) return errorResponse!;

  try {
    await db.$connect();
  } catch {
    return NextResponse.json({
      error: 'فشل الاتصال بقاعدة البيانات',
      hint: 'تأكد من تعيين DATABASE_URL في متغيرات بيئة Vercel'
    }, { status: 500 });
  }

  const DEVELOPER_EMAIL = process.env.DEVELOPER_EMAIL;
  const DEVELOPER_PASSWORD = process.env.DEVELOPER_PASSWORD;

  if (!DEVELOPER_EMAIL || !DEVELOPER_PASSWORD) {
    return NextResponse.json({
      error: 'بيانات المطور غير مهيأة. تأكد من تعيين DEVELOPER_EMAIL و DEVELOPER_PASSWORD'
    }, { status: 500 });
  }

  try {
    const existingAdmin = await db.user.findUnique({
      where: { identifier: DEVELOPER_EMAIL }
    });

    if (existingAdmin) {
      return NextResponse.json({
        success: true,
        message: 'قاعدة البيانات تمت تهيئتها مسبقاً ✅'
      });
    }

    const hashedPassword = await bcrypt.hash(DEVELOPER_PASSWORD, 12);
    await db.user.create({
      data: {
        email: DEVELOPER_EMAIL,
        identifier: DEVELOPER_EMAIL,
        name: 'المطور',
        phone: '',
        password: hashedPassword,
        role: 'DEVELOPER',
        isApproved: true,
        emailVerified: true,
      }
    });

    // Create default settings
    try {
      const existingSettings = await db.settings.findFirst();
      if (!existingSettings) {
        await db.settings.create({
          data: {
            contactFee: 50,
            regularFee: 30,
            featuredFee: 100,
            premiumFee: 200,
            vipFee: 300,
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
    } catch (settingsError) {
      console.error('Settings creation warning:', settingsError);
    }

    return NextResponse.json({
      success: true,
      message: 'تم تهيئة قاعدة البيانات بنجاح! ✅'
      // SECURITY: Never return credentials in response
    });

  } catch (dbError) {
    return NextResponse.json({
      error: 'خطأ في قاعدة البيانات',
      hint: 'تأكد أن الجداول موجودة وأن DATABASE_URL صحيح'
    }, { status: 500 });
  }
}

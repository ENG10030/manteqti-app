import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';

// مفتاح سري لحماية إنشاء قاعدة البيانات
const SETUP_KEY = process.env.SETUP_KEY || 'manteqti-setup-2024';

export async function GET(request: Request) {
  try {
    // التحقق من المفتاح السري
    const { searchParams } = new URL(request.url);
    const providedKey = searchParams.get('setupKey');

    if (!providedKey || providedKey !== SETUP_KEY) {
      return NextResponse.json(
        { error: 'غير مصرح بهذا الطلب' },
        { status: 403 }
      );
    }

    const DEVELOPER_EMAIL = process.env.DEVELOPER_EMAIL || 'ahmadmamdouh10030@gmail.com';
    const DEVELOPER_PASSWORD = process.env.DEVELOPER_PASSWORD || 'admin123';

    // التحقق من اتصال قاعدة البيانات
    try {
      await db.$connect();
    } catch (connectError: any) {
      return NextResponse.json({
        error: 'فشل الاتصال بقاعدة البيانات',
        details: connectError?.message,
        hint: 'تأكد من أن DATABASE_URL و DIRECT_DATABASE_URL موجودين على Vercel كـ "All Environments" وليس "Production only"'
      }, { status: 500 });
    }

    const existingAdmin = await db.user.findFirst({
      where: { 
        OR: [
          { identifier: DEVELOPER_EMAIL },
          { email: DEVELOPER_EMAIL }
        ]
      }
    });

    if (existingAdmin) {
      // تحديث بيانات المطور لو محتاج
      await db.user.update({
        where: { id: existingAdmin.id },
        data: {
          role: 'DEVELOPER',
          isApproved: true,
          emailVerified: true,
          identifier: DEVELOPER_EMAIL,
          email: DEVELOPER_EMAIL,
        }
      });

      // إنشاء الإعدادات لو مش موجودة
      try {
        const existingSettings = await db.settings.findFirst();
        if (!existingSettings) {
          await db.settings.create({
            data: {
              contactFee: 50,
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
      } catch (settingsError: any) {
        console.error('Settings warning:', settingsError?.message);
      }

      return NextResponse.json({
        success: true,
        message: 'قاعدة البيانات تمت تهيئتها مسبقاً ✅',
        admin: { email: existingAdmin.email, name: existingAdmin.name, role: existingAdmin.role },
        database: 'متصل ✅'
      });
    }

    const hashedPassword = await bcrypt.hash(DEVELOPER_PASSWORD, 10);
    const admin = await db.user.create({
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

    // إنشاء الإعدادات
    try {
      const existingSettings = await db.settings.findFirst();
      if (!existingSettings) {
        await db.settings.create({
          data: {
            contactFee: 50,
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
    } catch (settingsError: any) {
      console.error('Settings creation warning:', settingsError?.message);
    }

    return NextResponse.json({
      success: true,
      message: 'تم تهيئة قاعدة البيانات بنجاح! ✅',
      admin: { email: admin.email, name: admin.name, role: admin.role },
      database: 'متصل ✅',
      ...(process.env.NODE_ENV !== 'production' && {
        loginCredentials: { email: DEVELOPER_EMAIL, password: DEVELOPER_PASSWORD }
      })
    });

  } catch (error: any) {
    return NextResponse.json({
      error: 'خطأ غير متوقع',
      details: error?.message || String(error),
      hint: 'تأكد من: 1) DATABASE_URL صحيح 2) تم تشغيل prisma db push 3) الجداول موجودة في قاعدة البيانات'
    }, { status: 500 });
  } finally {
    await db.$disconnect();
  }
}

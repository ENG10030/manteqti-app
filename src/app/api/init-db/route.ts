import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';

// مفتاح سري لحماية إنشاء قاعدة البيانات - لازم يتغيّر!
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

    // التحقق من اتصال قاعدة البيانات
    await db.$connect();

    const DEVELOPER_EMAIL = process.env.DEVELOPER_EMAIL || 'ahmadmamdouh10030@gmail.com';
    const DEVELOPER_PASSWORD = process.env.DEVELOPER_PASSWORD || 'admin123';

    const existingAdmin = await db.user.findUnique({
      where: { identifier: DEVELOPER_EMAIL }
    });

    if (existingAdmin) {
      return NextResponse.json({
        success: true,
        message: 'قاعدة البيانات تمت تهيئتها مسبقاً ✅',
        admin: { email: existingAdmin.email, name: existingAdmin.name, role: existingAdmin.role }
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
      // ⚠️ لا نعيد كلمة السر في البيئة المنتجة
      ...(process.env.NODE_ENV !== 'production' && {
        loginCredentials: { email: DEVELOPER_EMAIL, password: DEVELOPER_PASSWORD }
      })
    });

  } catch (error: any) {
    return NextResponse.json({
      error: 'خطأ غير متوقع',
      details: error?.message || String(error)
    }, { status: 500 });
  } finally {
    await db.$disconnect();
  }
}

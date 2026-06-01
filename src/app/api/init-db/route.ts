import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';

// 🔒 SECURITY: لا يوجد fallback للمفتاح السري
const SETUP_KEY = process.env.SETUP_KEY;

export async function GET(request: Request) {
  try {
    if (!SETUP_KEY) {
      console.error('⚠️ CRITICAL: SETUP_KEY غير معرف - init-db معطل');
      return NextResponse.json({ error: 'خطأ في إعدادات الخادم' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const providedKey = searchParams.get('setupKey');

    if (!providedKey || providedKey !== SETUP_KEY) {
      return NextResponse.json({ error: 'غير مصرح بهذا الطلب' }, { status: 403 });
    }

    const DEVELOPER_EMAIL = process.env.DEVELOPER_EMAIL;
    const DEVELOPER_PASSWORD = process.env.DEVELOPER_PASSWORD;

    if (!DEVELOPER_EMAIL || !DEVELOPER_PASSWORD) {
      console.error('⚠️ CRITICAL: بيانات المطور غير معرفة');
      return NextResponse.json({ error: 'خطأ في إعدادات الخادم' }, { status: 500 });
    }

    try {
      await db.$connect();
    } catch (connectError: any) {
      console.error('DB connection error:', connectError?.code);
      return NextResponse.json({ error: 'فشل الاتصال بقاعدة البيانات' }, { status: 500 });
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

      // 🔒 لا نرجع credentials
      return NextResponse.json({
        success: true,
        message: 'قاعدة البيانات تمت تهيئتها مسبقاً ✅',
        database: 'متصل ✅'
      });
    }

    const hashedPassword = await bcrypt.hash(DEVELOPER_PASSWORD, 10);
    const admin = await db.user.create({
      data: {
        email: DEVELOPER_EMAIL,
        identifier: DEVELOPER_EMAIL,
        name: 'المطور',
        password: hashedPassword,
        role: 'DEVELOPER',
        isApproved: true,
        emailVerified: true,
      }
    });

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

    // 🔒 لا نرجع credentials
    return NextResponse.json({
      success: true,
      message: 'تم تهيئة قاعدة البيانات بنجاح! ✅',
      database: 'متصل ✅',
    });

  } catch (error: any) {
    console.error('Init DB error:', error?.code || error?.message);
    return NextResponse.json({ error: 'خطأ غير متوقع' }, { status: 500 });
  } finally {
    await db.$disconnect();
  }
}

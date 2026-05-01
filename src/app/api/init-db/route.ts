import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';

export async function GET() {
  try {
    // الخطوة 1: التحقق من اتصال قاعدة البيانات
    try {
      await db.$connect();
    } catch (connError: any) {
      return NextResponse.json({
        error: 'فشل الاتصال بقاعدة البيانات',
        details: connError?.message || String(connError),
        hint: 'تأكد من تعيين DATABASE_URL في متغيرات بيئة Vercel',
        requiredFormat: 'postgresql://user:password@host:5432/database?sslmode=require'
      }, { status: 500 });
    }

    const DEVELOPER_EMAIL = process.env.DEVELOPER_EMAIL || 'ahmadmamdouh10030@gmail.com';
    const DEVELOPER_PASSWORD = process.env.DEVELOPER_PASSWORD || 'admin123';

    // الخطوة 2: محاولة إنشاء المطور
    try {
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

      // الخطوة 3: إنشاء الإعدادات
      try {
        const existingSettings = await db.settings.findFirst();
        if (!existingSettings) {
          await db.settings.create({
            data: {
              contactFee: 50,
              featuredFee: 100,
              vipFee: 300,
              saleDisplayFee: 100,
              rentDisplayFee: 75,
              otherServicesFee: 50,
              priorityListingFee: 200,
              verifiedListingFee: 250,
              currency: 'ج.م',
            }
          });
        }
      } catch (settingsError: any) {
        // الإعدادات مش مهمة - المطور أهم
        console.error('Settings creation warning:', settingsError?.message);
      }

      return NextResponse.json({
        success: true,
        message: 'تم تهيئة قاعدة البيانات بنجاح! ✅',
        admin: { email: admin.email, name: admin.name, role: admin.role },
        loginCredentials: { email: DEVELOPER_EMAIL, password: DEVELOPER_PASSWORD }
      });

    } catch (dbError: any) {
      // لو الجدول مش موجود - نحتاج نعمل migration
      if (dbError instanceof Prisma.PrismaClientKnownRequestError) {
        if (dbError.code === 'P2021' || dbError.code === 'P2010' || 
            dbError.code === 'P1001' || dbError.code === 'P1008') {
          return NextResponse.json({
            error: 'الجداول غير موجودة في قاعدة البيانات',
            details: `Prisma Error ${dbError.code}: ${dbError.message}`,
            hint: 'يجب تشغيل: npx prisma db push --schema prisma/schema.prisma'
          }, { status: 500 });
        }
      }

      return NextResponse.json({
        error: 'خطأ في قاعدة البيانات',
        details: dbError?.message || String(dbError),
        prismaCode: dbError?.code || null,
        hint: 'تأكد أن الجداول موجودة وأن DATABASE_URL صحيح'
      }, { status: 500 });
    }

  } catch (error: any) {
    return NextResponse.json({
      error: 'خطأ غير متوقع',
      details: error?.message || String(error)
    }, { status: 500 });
  } finally {
    await db.$disconnect();
  }
}

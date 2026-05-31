import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { requireDeveloper } from '@/lib/auth-middleware';

export async function POST(request: NextRequest) {
  try {
    const { auth, errorResponse } = await requireDeveloper(request);
    if (errorResponse) return errorResponse;

    try {
      await db.$connect();
    } catch {
      return NextResponse.json({
        error: 'فشل الاتصال بقاعدة البيانات',
        hint: 'تأكد من تعيين DATABASE_URL في متغيرات بيئة Vercel'
      }, { status: 500 });
    }

    const developerPassword = process.env.DEVELOPER_PASSWORD;
    const developerEmail = process.env.DEVELOPER_EMAIL;
    
    if (!developerPassword) {
      return NextResponse.json({ error: 'لم يتم تعيين كلمة مرور المطور', hint: 'يجب تعيين DEVELOPER_PASSWORD' }, { status: 500 });
    }
    if (!developerEmail) {
      return NextResponse.json({ error: 'لم يتم تعيين إيميل المطور', hint: 'يجب تعيين DEVELOPER_EMAIL' }, { status: 500 });
    }

    const existingAdmin = await db.user.findUnique({ where: { identifier: developerEmail } });

    if (existingAdmin) {
      return NextResponse.json({
        success: true,
        message: 'قاعدة البيانات تمت تهيئتها مسبقاً ✅',
        admin: { email: existingAdmin.email, name: existingAdmin.name, role: existingAdmin.role }
      });
    }

    const hashedPassword = await bcrypt.hash(developerPassword, 10);
    const admin = await db.user.create({
      data: {
        email: developerEmail,
        identifier: developerEmail,
        name: 'المطور - أحمد',
        phone: '+201234567890',
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
            contactFee: 50, regularFee: 30, featuredFee: 100, premiumFee: 200,
            vipFee: 300, saleDisplayFee: 100, rentDisplayFee: 75, otherServicesFee: 50,
            highlightFee: 150, priorityListingFee: 200, verifiedListingFee: 250,
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
      admin: { email: admin.email, name: admin.name, role: admin.role }
    });

  } catch (error: any) {
    // HIGH FIX: Don't expose Prisma error details to client
    console.error('Init DB error:', error);
    
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (['P2021', 'P2010', 'P1001', 'P1008'].includes(error.code)) {
        return NextResponse.json({
          error: 'الجداول غير موجودة في قاعدة البيانات',
          hint: 'يجب تشغيل: npx prisma db push'
        }, { status: 500 });
      }
    }

    return NextResponse.json({ error: 'خطأ في قاعدة البيانات' }, { status: 500 });
  }
}

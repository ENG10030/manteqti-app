import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';
import { verify } from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';

const JWT_SECRET = process.env.JWT_SECRET;

// التحقق من أن الطلب من مطور
async function verifyDeveloper(): Promise<boolean> {
  if (!JWT_SECRET) return false;
  
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;
    if (!token) return false;
    
    const decoded = verify(token, JWT_SECRET) as { role?: string };
    return decoded.role === 'DEVELOPER';
  } catch {
    return false;
  }
}

export async function GET() {
  try {
    // 🔒 الأمان: فقط المطور يمكنه تهيئة قاعدة البيانات
    if (!(await verifyDeveloper())) {
      return NextResponse.json({
        error: 'غير مصرح - هذه العملية مخصصة للمطور فقط',
      }, { status: 403 });
    }

    // التحقق من اتصال قاعدة البيانات
    try {
      await db.$connect();
    } catch (connError: unknown) {
      return NextResponse.json({
        error: 'فشل الاتصال بقاعدة البيانات',
        hint: 'تأكد من تعيين DATABASE_URL في متغيرات بيئة Vercel',
        requiredFormat: 'postgresql://user:password@host:5432/database?sslmode=require'
      }, { status: 500 });
    }

    const DEVELOPER_EMAIL = process.env.DEVELOPER_EMAIL;
    const DEVELOPER_PASSWORD = process.env.DEVELOPER_PASSWORD;

    if (!DEVELOPER_EMAIL || !DEVELOPER_PASSWORD) {
      return NextResponse.json({
        error: 'متغيرات بيئة المطور غير مضبوطة (DEVELOPER_EMAIL, DEVELOPER_PASSWORD)',
      }, { status: 500 });
    }

    // محاولة إنشاء المطور
    try {
      const existingAdmin = await db.user.findUnique({
        where: { identifier: DEVELOPER_EMAIL }
      });

      if (existingAdmin) {
        return NextResponse.json({
          success: true,
          message: 'قاعدة البيانات تمت تهيئتها مسبقاً ✅',
          admin: { email: existingAdmin.email, name: existingAdmin.name, role: existingAdmin.role }
          // 🔒 لا نرجع كلمة السر أبداً
        });
      }

      const hashedPassword = await bcrypt.hash(DEVELOPER_PASSWORD, 12);
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
      } catch (settingsError: unknown) {
        console.error('Settings creation warning:', settingsError instanceof Error ? settingsError.message : String(settingsError));
      }

      return NextResponse.json({
        success: true,
        message: 'تم تهيئة قاعدة البيانات بنجاح! ✅',
        admin: { email: admin.email, name: admin.name, role: admin.role }
        // 🔒 لا نرجع كلمة السر أبداً
      });

    } catch (dbError: unknown) {
      if (dbError instanceof Prisma.PrismaClientKnownRequestError) {
        if (dbError.code === 'P2021' || dbError.code === 'P2010' || 
            dbError.code === 'P1001' || dbError.code === 'P1008') {
          return NextResponse.json({
            error: 'الجداول غير موجودة في قاعدة البيانات',
            hint: 'يجب تشغيل: npx prisma db push --schema prisma/schema.prisma'
          }, { status: 500 });
        }
      }

      return NextResponse.json({
        error: 'خطأ في قاعدة البيانات',
        hint: 'تأكد أن الجداول موجودة وأن DATABASE_URL صحيح'
      }, { status: 500 });
    }

  } catch (error: unknown) {
    return NextResponse.json({
      error: 'خطأ غير متوقع',
    }, { status: 500 });
  } finally {
    await db.$disconnect();
  }
}

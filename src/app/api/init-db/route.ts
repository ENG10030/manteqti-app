import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { verify } from 'jsonwebtoken';
import { Prisma } from '@prisma/client';

const JWT_SECRET = process.env.JWT_SECRET || "manteqti-secret-key-2024";
const DEVELOPER_EMAIL = process.env.DEVELOPER_EMAIL || "ahmadmamdouh10030@gmail.com";

// 🔒 SECURITY FIX: Developer-only access to database initialization
async function requireDeveloper(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;
  if (!token) return false;

  try {
    const decoded = verify(token, JWT_SECRET) as { userId: string; role?: string; identifier?: string };
    if (decoded.role === "DEVELOPER" || decoded.identifier === DEVELOPER_EMAIL) return true;
    return false;
  } catch {
    return false;
  }
}

export async function GET() {
  try {
    // 🔒 SECURITY FIX: Require developer authentication before any DB operations
    if (!(await requireDeveloper())) {
      return NextResponse.json({ error: 'غير مصرح - تهيئة قاعدة البيانات متاحة للمطور فقط' }, { status: 403 });
    }

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

    const DEVELOPER_PASSWORD = process.env.DEVELOPER_PASSWORD;

    // خطأ: DEVELOPER_PASSWORD مطلوب — مش مسموح بالباسورد الافتراضية
    if (!DEVELOPER_PASSWORD) {
      return NextResponse.json({
        error: 'لا يمكن تهيئة قاعدة البيانات: DEVELOPER_PASSWORD غير موجود',
        hint: 'أضف DEVELOPER_PASSWORD في متغيرات بيئة Vercel (باسورد قوية)',
        note: 'الباسورد الافتراضية تم إزالتها لأسباب أمنية'
      }, { status: 500 });
    }

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
      } catch (settingsError: any) {
        console.error('Settings creation warning:', settingsError?.message);
      }

      return NextResponse.json({
        success: true,
        message: 'تم تهيئة قاعدة البيانات بنجاح! ✅',
        admin: { email: admin.email, name: admin.name, role: admin.role },
        // NO password in response — security fix
      });

    } catch (dbError: any) {
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

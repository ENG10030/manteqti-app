import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { verify } from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || "manteqti-secret-key-2024";
const DEVELOPER_EMAIL = process.env.DEVELOPER_EMAIL || 'ahmadmamdouh10030@gmail.com';

async function isDeveloper(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get('auth-token')?.value;
  if (!token) return false;
  try {
    const decoded = verify(token, JWT_SECRET) as { userId?: string; role?: string; identifier?: string };
    if (decoded.role === 'DEVELOPER' || decoded.identifier === DEVELOPER_EMAIL) return true;
    if (decoded.userId) {
      const user = await db.user.findUnique({ where: { id: decoded.userId }, select: { role: true, identifier: true } });
      return user?.role === 'DEVELOPER' || user?.identifier === DEVELOPER_EMAIL;
    }
    return false;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Auth check: only developers can initialize the database
    const dev = await isDeveloper(request);
    if (!dev) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
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

    const developerPassword = process.env.DEVELOPER_PASSWORD;
    if (!developerPassword) {
      return NextResponse.json({
        error: 'لم يتم تعيين كلمة مرور المطور',
        hint: 'يجب تعيين DEVELOPER_PASSWORD في متغيرات البيئة'
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

      const hashedPassword = await bcrypt.hash(developerPassword, 10);
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
        // الإعدادات مش مهمة - المطور أهم
        console.error('Settings creation warning:', settingsError?.message);
      }

      return NextResponse.json({
        success: true,
        message: 'تم تهيئة قاعدة البيانات بنجاح! ✅',
        admin: { email: admin.email, name: admin.name, role: admin.role }
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



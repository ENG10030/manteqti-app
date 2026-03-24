import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import crypto from 'crypto';

// تشفير كلمة المرور
function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

export async function GET() {
  try {
    // التحقق من وجود مستخدم المطور
    const DEVELOPER_EMAIL = process.env.DEVELOPER_EMAIL || 'ahmadmamdouh10030@gmail.com';
    const DEVELOPER_PASSWORD = process.env.DEVELOPER_PASSWORD || 'admin123';
    
    // البحث بالبريد الإلكتروني (حقل فريد)
    const existingAdmin = await db.user.findUnique({
      where: { identifier: DEVELOPER_EMAIL }
    });

    if (existingAdmin) {
      return NextResponse.json({ 
        message: 'قاعدة البيانات تمت تهيئتها مسبقاً',
        admin: { email: existingAdmin.email, name: existingAdmin.name }
      });
    }

    // إنشاء مستخدم المطور
    const admin = await db.user.create({
      data: {
        email: DEVELOPER_EMAIL,
        identifier: DEVELOPER_EMAIL,
        name: 'المطور - أحمد',
        phone: '+201234567890',
        password: hashPassword(DEVELOPER_PASSWORD),
        role: 'DEVELOPER',
      }
    });

    // إنشاء إعدادات افتراضية
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

    // إنشاء عقارات تجريبية
    const apartments = await Promise.all([
      db.apartment.create({
        data: {
          title: 'شقة فاخرة في مدينة نصر',
          description: 'شقة واسعة ومشرقة مع إطلالة رائعة.',
          price: 850000,
          area: 'مدينة نصر',
          bedrooms: 3,
          bathrooms: 2,
          type: 'sale',
          status: 'available',
          ownerPhone: '+201001234567',
          mapLink: 'https://maps.google.com/?q=30.0444,31.2357',
          images: JSON.stringify(['https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800']),
          amenities: JSON.stringify(['مصعد', 'أمن', 'جراج']),
          isFeatured: true,
          isVip: true,
          createdBy: admin.id,
        }
      }),
      db.apartment.create({
        data: {
          title: 'استوديو مفروش للإيجار',
          description: 'استوديو مفشف بالكامل قريب من المترو.',
          price: 3500,
          area: 'التجمع الخامس',
          bedrooms: 1,
          bathrooms: 1,
          type: 'rent',
          status: 'available',
          ownerPhone: '+201009876543',
          mapLink: 'https://maps.google.com/?q=30.0626,31.2497',
          images: JSON.stringify(['https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800']),
          amenities: JSON.stringify(['مفروش', 'تكييف']),
          isFeatured: true,
          isVip: false,
          createdBy: admin.id,
        }
      }),
      db.apartment.create({
        data: {
          title: 'فيلا بحديقة خاصة',
          description: 'فيلا فاخرة مع مسبح خاص.',
          price: 3500000,
          area: 'الشيخ زايد',
          bedrooms: 5,
          bathrooms: 4,
          type: 'sale',
          status: 'available',
          ownerPhone: '+201112223334',
          mapLink: 'https://maps.google.com/?q=30.0300,31.2000',
          images: JSON.stringify(['https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800']),
          amenities: JSON.stringify(['مسبح', 'حديقة', 'جراج']),
          isFeatured: false,
          isVip: true,
          createdBy: admin.id,
        }
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: 'تم تهيئة قاعدة البيانات بنجاح!',
      adminCredentials: {
        email: DEVELOPER_EMAIL,
        password: DEVELOPER_PASSWORD
      },
      apartmentsCount: apartments.length
    });

  } catch (error) {
    console.error('Init error:', error);
    return NextResponse.json({ 
      error: 'حدث خطأ',
      details: error instanceof Error ? error.message : 'Unknown'
    }, { status: 500 });
  }
}
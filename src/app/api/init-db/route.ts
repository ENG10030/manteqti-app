import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function GET() {
  try {
    const DEVELOPER_EMAIL = process.env.DEVELOPER_EMAIL || 'ahmadmamdouh10030@gmail.com';
    const DEVELOPER_PASSWORD = process.env.DEVELOPER_PASSWORD || 'admin123';
    
    const existingAdmin = await db.user.findUnique({
      where: { identifier: DEVELOPER_EMAIL }
    });

    if (existingAdmin) {
      return NextResponse.json({ 
        message: 'قاعدة البيانات تمت تهيئتها مسبقاً',
        admin: { email: existingAdmin.email, name: existingAdmin.name }
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
      }
    });

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

    return NextResponse.json({
      success: true,
      message: 'تم تهيئة قاعدة البيانات بنجاح!',
      adminCredentials: { email: DEVELOPER_EMAIL, password: DEVELOPER_PASSWORD }
    });

  } catch (error) {
    console.error('Init error:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
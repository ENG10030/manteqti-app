import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import crypto from "crypto";

// تشفير كلمة المرور
function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

export async function GET() {
  try {
    const existingDeveloper = await db.user.findFirst({
      where: { role: "DEVELOPER" },
    });

    if (existingDeveloper) {
      return NextResponse.json({
        message: "البيانات التجريبية موجودة بالفعل",
        developer: {
          id: existingDeveloper.id,
          email: existingDeveloper.email,
          name: existingDeveloper.name,
        },
      });
    }

    const hashedPassword = hashPassword("admin123");
    const developer = await db.user.create({
      data: {
        email: "ahmadmamdouh10030@gmail.com",
        identifier: "ahmadmamdouh10030@gmail.com",
        name: "المطور الرئيسي",
        password: hashedPassword,
        role: "DEVELOPER",
        isApproved: true,
      },
    });

    const userPassword = hashPassword("user123");
    const user = await db.user.create({
      data: {
        email: "user@example.com",
        identifier: "user@example.com",
        name: "مستخدم تجريبي",
        password: userPassword,
        role: "USER",
        isApproved: true,
      },
    });

    // إنشاء إعدادات افتراضية (فقط إذا لم تكن موجودة)
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
          currency: "ج.م",
        },
      });
    }

    // إنشاء عقارات تجريبية
    const apartments = await Promise.all([
      db.apartment.create({
        data: {
          title: "شقة فاخرة في مدينة نصر",
          description: "شقة فاخرة بمساحة 180 متر مربع، 3 غرف نوم، 2 حمام",
          price: 450000,
          area: "مدينة نصر",
          bedrooms: 3,
          bathrooms: 2,
          type: "sale",
          status: "available",
          ownerPhone: "+201001234567",
          mapLink: "https://maps.google.com/?q=30.0444,31.2357",
          images: JSON.stringify(["https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800"]),
          amenities: JSON.stringify(["مصعد", "أمن", "جراج"]),
          isFeatured: true,
          isVip: false,
          createdBy: developer.id,
        },
      }),
      db.apartment.create({
        data: {
          title: "فيلا حديثة في التجمع الخامس",
          description: "فيلا حديثة بمساحة 350 متر مربع، 5 غرف نوم، 4 حمامات",
          price: 3500000,
          area: "التجمع الخامس",
          bedrooms: 5,
          bathrooms: 4,
          type: "sale",
          status: "available",
          ownerPhone: "+201009876543",
          mapLink: "https://maps.google.com/?q=30.0626,31.2497",
          images: JSON.stringify(["https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800"]),
          amenities: JSON.stringify(["مسبح", "حديقة", "جراج"]),
          isFeatured: true,
          isVip: true,
          createdBy: developer.id,
        },
      }),
      db.apartment.create({
        data: {
          title: "شقة للإيجار في المعادي",
          description: "شقة مفروشة للإيجار بمساحة 120 متر مربع",
          price: 5000,
          area: "المعادي",
          bedrooms: 2,
          bathrooms: 1,
          type: "rent",
          status: "available",
          ownerPhone: "+201112223334",
          mapLink: "https://maps.google.com/?q=29.9608,31.2625",
          images: JSON.stringify(["https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800"]),
          amenities: JSON.stringify(["مفروش", "تكييف"]),
          isFeatured: false,
          isVip: false,
          createdBy: developer.id,
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: "تم إنشاء البيانات التجريبية بنجاح",
      credentials: {
        developer: {
          email: "ahmadmamdouh10030@gmail.com",
          password: "admin123",
        },
        user: {
          email: "user@example.com",
          password: "user123",
        },
      },
      apartmentsCount: apartments.length,
    });
  } catch (error) {
    console.error("Seed error:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء إنشاء البيانات التجريبية", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    );
  }
}
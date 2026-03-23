import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";

// API لإنشاء بيانات تجريبية
export async function GET() {
  try {
    // التحقق من وجود مطور
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

    // إنشاء المطور
    const hashedPassword = await bcrypt.hash("admin123", 10);
    const developer = await db.user.create({
      data: {
        email: "ahmadmamdouh10030@gmail.com",
        name: "المطور الرئيسي",
        password: hashedPassword,
        role: "DEVELOPER",
        isApproved: true,
      },
    });

    // إنشاء مستخدم تجريبي
    const userPassword = await bcrypt.hash("user123", 10);
    const user = await db.user.create({
      data: {
        email: "user@example.com",
        name: "مستخدم تجريبي",
        password: userPassword,
        role: "USER",
        isApproved: true,
      },
    });

    // إنشاء إعدادات افتراضية
    await db.settings.create({
      data: {
        siteName: "منطقتي",
        siteDescription: "منصة عقارية متكاملة",
        contactEmail: "info@manteqti.com",
        contactPhone: "+966500000000",
        featuredFee: 100,
        vipFee: 200,
        commissionRate: 5,
        minWithdrawal: 100,
        maxApartmentsPerUser: 10,
        allowUserRegistration: true,
        requireApproval: true,
      },
    });

    // إنشاء عقارات تجريبية
    const apartments = await Promise.all([
      db.apartment.create({
        data: {
          title: "شقة فاخرة في حي النخيل",
          description: "شقة فاخرة بمساحة 200 متر مربع، 3 غرف نوم، 2 حمام، مطبخ مجهز بالكامل",
          price: 450000,
          area: 200,
          rooms: 3,
          bathrooms: 2,
          city: "الرياض",
          neighborhood: "حي النخيل",
          address: "شارع الملك فهد، عمارة 15",
          type: "SALE",
          status: "AVAILABLE",
          isFeatured: true,
          isVip: false,
          createdBy: developer.id,
          images: ["https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800"],
        },
      }),
      db.apartment.create({
        data: {
          title: "فيلا حديثة في حي الملقا",
          description: "فيلا حديثة بمساحة 400 متر مربع، 5 غرف نوم، 4 حمامات، حديقة خاصة ومسبح",
          price: 1500000,
          area: 400,
          rooms: 5,
          bathrooms: 4,
          city: "الرياض",
          neighborhood: "حي الملقا",
          address: "شارع العروبة، فيلا 22",
          type: "SALE",
          status: "AVAILABLE",
          isFeatured: true,
          isVip: true,
          createdBy: developer.id,
          images: ["https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800"],
        },
      }),
      db.apartment.create({
        data: {
          title: "شقة للإيجار في حي العليا",
          description: "شقة للإيجار بمساحة 150 متر، غرفتين نوم، حمام، قريبة من الخدمات",
          price: 3000,
          area: 150,
          rooms: 2,
          bathrooms: 1,
          city: "الرياض",
          neighborhood: "حي العليا",
          address: "شارع العليا، عمارة 8",
          type: "RENT",
          status: "AVAILABLE",
          isFeatured: false,
          isVip: false,
          createdBy: user.id,
          images: ["https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800"],
        },
      }),
    ]);

    return NextResponse.json({
      message: "تم إنشاء البيانات التجريبية بنجاح",
      developer: {
        id: developer.id,
        email: developer.email,
        name: developer.name,
      },
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      apartmentsCount: apartments.length,
    });
  } catch (error) {
    console.error("Seed error:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء إنشاء البيانات التجريبية" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cookies } from 'next/headers';
import { verify } from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || "manteqti-secret-key-2024";

const sampleApartments = [
  {
    title: "شقة فاخرة في مدينة نصر",
    description: "شقة فاخرة بمساحة 180 متر مربع، 3 غرف نوم، 2 حمام، تشطيب سوبر لوكس، حصة كاملة، فيلا كمباوند امن وحراسة ٢٤ ساعة",
    price: 4500000,
    area: "مدينة نصر",
    bedrooms: 3,
    bathrooms: 2,
    floor: 5,
    apartmentSize: 180,
    type: "sale",
    status: "available",
    ownerPhone: "+201001234567",
    mapLink: "https://maps.google.com/?q=30.0444,31.2357",
    imageUrl: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800",
    images: JSON.stringify(["https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800", "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800"]),
    amenities: JSON.stringify(["مصعد", "أمن", "جراج", "حديقة", "مسبح"]),
    isFeatured: true,
    isVip: false,
  },
  {
    title: "فيلا حديثة في التجمع الخامس",
    description: "فيلا حديثة بمساحة 350 متر مربع، 5 غرف نوم، 4 حمامات، تصميم عصري مع حديقة خاصة ومسبح",
    price: 8500000,
    area: "التجمع الخامس",
    bedrooms: 5,
    bathrooms: 4,
    floor: 3,
    apartmentSize: 350,
    type: "sale",
    status: "available",
    ownerPhone: "+201009876543",
    imageUrl: "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800",
    images: JSON.stringify(["https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800", "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800"]),
    amenities: JSON.stringify(["مسبح", "حديقة", "جراج", "حارس أمن", "ملعب"]),
    isFeatured: true,
    isVip: true,
  },
  {
    title: "شقة مفروشة للإيجار في المعادي",
    description: "شقة مفروشة بالكامل للإيجار في موقع مميز بالمعادي، قريبة من النيل والمراكز التجارية",
    price: 8000,
    area: "المعادي",
    bedrooms: 2,
    bathrooms: 1,
    floor: 3,
    apartmentSize: 120,
    type: "rent",
    status: "available",
    ownerPhone: "+201112223344",
    imageUrl: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800",
    images: JSON.stringify(["https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800"]),
    amenities: JSON.stringify(["مفروش", "تكييف", "غسالة", "ثلاجة"]),
    isFeatured: false,
    isVip: false,
  },
  {
    title: "بنتهاوس فاخر في الزمالك",
    description: "بنتهاوس بإطلالة على النيل، تشطيب هايبر لوكس، مساحة واسعة مع تراس كبير",
    price: 12000000,
    area: "الزمالك",
    bedrooms: 4,
    bathrooms: 3,
    floor: 12,
    apartmentSize: 250,
    type: "sale",
    status: "available",
    ownerPhone: "+201155667788",
    imageUrl: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800",
    images: JSON.stringify(["https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800"]),
    amenities: JSON.stringify(["إطلالة على النيل", "تراس", "مصعد خاص", "أمن"]),
    isFeatured: true,
    isVip: true,
  },
  {
    title: "استوديو مفروش للإيجار",
    description: "استوديو مفروش بالكامل، مناسب للطلاب والأفراد، في موقع مميز",
    price: 3500,
    area: "الدقي",
    bedrooms: 1,
    bathrooms: 1,
    floor: 2,
    apartmentSize: 55,
    type: "rent",
    status: "available",
    ownerPhone: "+201199887766",
    imageUrl: "https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800",
    images: JSON.stringify(["https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800"]),
    amenities: JSON.stringify(["مفروش", "تكييف", "واي فاي"]),
    isFeatured: false,
    isVip: false,
  },
  {
    title: "شقة 3 غرف في الشيخ زايد",
    description: "شقة في كمباوند متكامل، 3 غرف نوم، تشطيب سوبر لوكس، قريبة من المحور",
    price: 2800000,
    area: "الشيخ زايد",
    bedrooms: 3,
    bathrooms: 2,
    floor: 4,
    apartmentSize: 165,
    type: "sale",
    status: "available",
    ownerPhone: "+201123456789",
    imageUrl: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800",
    images: JSON.stringify(["https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800"]),
    amenities: JSON.stringify(["كمباوند", "أمن", "جراج", "حديقة", "نادي"]),
    isFeatured: true,
    isVip: false,
  },
  {
    title: "شقة للإيجار في أكتوبر",
    description: "شقة واسعة في أكتوبر، مناسبة للعائلات، قريبة من جميع الخدمات",
    price: 5500,
    area: "أكتوبر",
    bedrooms: 3,
    bathrooms: 2,
    floor: 6,
    apartmentSize: 150,
    type: "rent",
    status: "available",
    ownerPhone: "+201134567890",
    imageUrl: "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800",
    images: JSON.stringify(["https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800"]),
    amenities: JSON.stringify(["تكييف", "مطبخ مجهز", "واي فاي"]),
    isFeatured: false,
    isVip: false,
  },
  {
    title: "دوبلكس في مصر الجديدة",
    description: "دوبلكس فاخر بمساحة 220 متر، تصميم عصري، موقع مميز في قلب مصر الجديدة",
    price: 6500000,
    area: "مصر الجديدة",
    bedrooms: 4,
    bathrooms: 3,
    floor: 8,
    apartmentSize: 220,
    type: "sale",
    status: "available",
    ownerPhone: "+201145678901",
    imageUrl: "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=800",
    images: JSON.stringify(["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=800"]),
    amenities: JSON.stringify(["رووف", "مصعد", "أمن", "جراج"]),
    isFeatured: true,
    isVip: false,
  },
  {
    title: "شقة اقتصادية في عين شمس",
    description: "شقة اقتصادية مناسبة للشباب والأسر حديثة، 2 غرف نوم وحصة",
    price: 1200000,
    area: "عين شمس",
    bedrooms: 2,
    bathrooms: 1,
    floor: 3,
    apartmentSize: 90,
    type: "sale",
    status: "available",
    ownerPhone: "+201156789012",
    imageUrl: "https://images.unsplash.com/photo-1600573472591-ee6981cf81f0?w=800",
    images: JSON.stringify(["https://images.unsplash.com/photo-1600573472591-ee6981cf81f0?w=800"]),
    amenities: JSON.stringify(["مصعد", "مياه ساخنة"]),
    isFeatured: false,
    isVip: false,
  },
  {
    title: "شقة فاخرة للإيجار في التجمع الخامس",
    description: "شقة مؤثثة بالكامل في التجمع الخامس، مجهزة بأعلى مستوى، مناسبة للمدراء",
    price: 15000,
    area: "التجمع الخامس",
    bedrooms: 3,
    bathrooms: 2,
    floor: 7,
    apartmentSize: 200,
    type: "rent",
    status: "available",
    ownerPhone: "+201167890123",
    imageUrl: "https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=800",
    images: JSON.stringify(["https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=800"]),
    amenities: JSON.stringify(["مؤثثة", "تكييف مركزي", "غسالة", "ثلاجة", "واي فاي", "مسبح", "جيم"]),
    isFeatured: true,
    isVip: true,
  },
  {
    title: "فيلا فيلو في الشيخ زايد",
    description: "فيلا مستقلة فيلاو في الشيخ زايد، حديقة خاصة، مسبح، تشطيب هايبر لوكس",
    price: 15000000,
    area: "الشيخ زايد",
    bedrooms: 6,
    bathrooms: 5,
    floor: 2,
    apartmentSize: 450,
    type: "sale",
    status: "available",
    ownerPhone: "+201178901234",
    imageUrl: "https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=800",
    images: JSON.stringify(["https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=800"]),
    amenities: JSON.stringify(["مسبح خاص", "حديقة", "جراج 3 سيارات", "حارس", "كاميرات"]),
    isFeatured: false,
    isVip: true,
  },
  {
    title: "شقة للإيجار في حلوان",
    description: "شقة اقتصادية للإيجار في حلوان، مناسبة للطلاب والأفراد",
    price: 2500,
    area: "حلوان",
    bedrooms: 1,
    bathrooms: 1,
    floor: 1,
    apartmentSize: 65,
    type: "rent",
    status: "available",
    ownerPhone: "+201189012345",
    imageUrl: "https://images.unsplash.com/photo-1600585153490-76fb20a32601?w=800",
    images: JSON.stringify(["https://images.unsplash.com/photo-1600585153490-76fb20a32601?w=800"]),
    amenities: JSON.stringify(["تكييف", "واي فاي"]),
    isFeatured: false,
    isVip: false,
  },
];

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول كمطور أولاً' }, { status: 401 });
    }

    let decoded: any;
    try {
      decoded = verify(token, JWT_SECRET);
    } catch {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }

    if (decoded.role !== 'DEVELOPER') {
      return NextResponse.json({ error: 'فقط المطور يمكنه إنشاء بيانات تجريبية' }, { status: 403 });
    }

    const developer = await db.user.findFirst({ where: { role: "DEVELOPER" } });
    if (!developer) {
      return NextResponse.json({ error: 'المطور غير موجود، سجل دخولك كمطور أولاً' }, { status: 400 });
    }

    // إنشاء إعدادات افتراضية إذا لم تكن موجودة
    const existingSettings = await db.settings.findFirst();
    if (!existingSettings) {
      await db.settings.create({
        data: { contactFee: 50, regularFee: 30, featuredFee: 100, premiumFee: 200, vipFee: 300, saleDisplayFee: 100, rentDisplayFee: 75, otherServicesFee: 50, highlightFee: 150, priorityListingFee: 200, verifiedListingFee: 250, currency: "ج.م" },
      });
    }

    // إنشاء الإعلانات التي لا تتواجد بعد
    let created = 0;
    let skipped = 0;

    for (const apt of sampleApartments) {
      const exists = await db.apartment.findFirst({
        where: { title: apt.title, createdBy: developer.id },
      });

      if (!exists) {
        await db.apartment.create({
          data: {
            ...apt,
            createdBy: developer.id,
          },
        });
        created++;
      } else {
        skipped++;
      }
    }

    const totalApartments = await db.apartment.count({ where: { createdBy: developer.id } });

    return NextResponse.json({
      success: true,
      message: `تم إنشاء ${created} إعلان جديد (تم تخطي ${skipped} إعلان موجود)`,
      totalDeveloperApartments: totalApartments,
      totalAllApartments: await db.apartment.count(),
    });
  } catch (error) {
    console.error("Seed error:", error);
    return NextResponse.json(
      { error: "حدث خطأ", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Professional apartment images from Unsplash
const apartmentImages = [
  'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=80',
  'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80',
  'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&q=80',
  'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800&q=80',
  'https://images.unsplash.com/photo-1507089947368-19c1da9775ae?w=800&q=80',
  'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&q=80',
  'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80',
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80',
];

export async function GET() {
  try {
    // Clear existing data
    await db.payment.deleteMany().catch(() => {});
    await db.inquiry.deleteMany().catch(() => {});
    await db.apartment.deleteMany().catch(() => {});

    // Create sample apartments with proper area names
    const apartments = await Promise.all([
      db.apartment.create({
        data: {
          title: 'شقة فاخرة في مدينة نصر',
          price: 8500,
          area: 'مدينة نصر',
          bedrooms: 3,
          bathrooms: 2,
          description: 'شقة فاخرة بتصميم عصري. تشطيب سوبر لوكس مع مطبخ مجهز بالكامل. الموقع متميز قريب من المدارس والمولات التجارية.',
          ownerPhone: '+201001234567',
          mapLink: 'https://maps.google.com/?q=Nasr+City+Cairo',
          imageUrl: apartmentImages[0],
          images: JSON.stringify([apartmentImages[0], apartmentImages[1]]),
          amenities: JSON.stringify(['مصعد', 'أمن 24 ساعة', 'موقف سيارات']),
          featured: true,
          isFeatured: true,
          isVip: true,
          type: 'rent',
          status: 'available',
        }
      }),
      db.apartment.create({
        data: {
          title: 'فيلا مستقلة بالتجمع الخامس',
          price: 15000000,
          area: 'التجمع الخامس',
          bedrooms: 5,
          bathrooms: 4,
          description: 'فيلا فاخرة مع حديقة خاصة ومسبح. تصميم كلاسيكي فاخر مع تشطيبات راقية.',
          ownerPhone: '+201229876543',
          mapLink: 'https://maps.google.com/?q=Fifth+Settlement+Cairo',
          imageUrl: apartmentImages[5],
          images: JSON.stringify([apartmentImages[5], apartmentImages[6]]),
          amenities: JSON.stringify(['حديقة خاصة', 'مسبح خاص', 'موقف سيارات', 'أمن']),
          featured: true,
          isFeatured: true,
          isVip: true,
          type: 'sale',
          status: 'available',
        }
      }),
      db.apartment.create({
        data: {
          title: 'استوديو مودرن بالمعادي',
          price: 4500,
          area: 'المعادي',
          bedrooms: 1,
          bathrooms: 1,
          description: 'استوديو أنيق مثالي للعزاب والمحترفين، قريب من المترو والخدمات.',
          ownerPhone: '+201115554433',
          mapLink: 'https://maps.google.com/?q=Maadi+Cairo',
          imageUrl: apartmentImages[2],
          images: JSON.stringify([apartmentImages[2]]),
          amenities: JSON.stringify(['قريب من المترو', 'تشطيب مودرن']),
          featured: false,
          type: 'rent',
          status: 'available',
        }
      }),
      db.apartment.create({
        data: {
          title: 'شقة بحرية بالإسكندرية',
          price: 3500000,
          area: 'الإسكندرية',
          bedrooms: 4,
          bathrooms: 3,
          description: 'شقة بإطلالة بحرية مباشرة على البحر المتوسط. بلكونة كبيرة مع إطلالة بانورامية.',
          ownerPhone: '+2031234567',
          mapLink: 'https://maps.google.com/?q=Alexandria+Egypt',
          imageUrl: apartmentImages[3],
          images: JSON.stringify([apartmentImages[3], apartmentImages[4]]),
          amenities: JSON.stringify(['إطلالة بحرية', 'بلكونة كبيرة', 'موقف سيارات']),
          featured: true,
          isFeatured: true,
          type: 'sale',
          status: 'available',
        }
      }),
      db.apartment.create({
        data: {
          title: 'دوبلكس بالشيخ زايد',
          price: 12000,
          area: 'الشيخ زايد',
          bedrooms: 4,
          bathrooms: 3,
          description: 'دوبلكس واسع في كمباوند راقي مع حديقة خاصة. تصميم مفتوح وإضاءة طبيعية ممتازة.',
          ownerPhone: '+201552221111',
          mapLink: 'https://maps.google.com/?q=Sheikh+Zayed+Egypt',
          imageUrl: apartmentImages[7],
          images: JSON.stringify([apartmentImages[7], apartmentImages[0]]),
          amenities: JSON.stringify(['دوبلكس', 'كمباوند', 'أمن', 'نادي صحي']),
          featured: false,
          type: 'rent',
          status: 'available',
        }
      }),
      db.apartment.create({
        data: {
          title: 'شقة في المهندسين',
          price: 7000,
          area: 'المهندسين',
          bedrooms: 2,
          bathrooms: 1,
          description: 'شقة أنيقة في قلب المهندسين قريبة من كل الخدمات والمطاعم.',
          ownerPhone: '+201123332222',
          mapLink: 'https://maps.google.com/?q=Mohandessin+Cairo',
          imageUrl: apartmentImages[4],
          images: JSON.stringify([apartmentImages[4], apartmentImages[1]]),
          amenities: JSON.stringify(['قريب من الخدمات', 'مصعد', 'أمن']),
          featured: false,
          type: 'rent',
          status: 'available',
        }
      }),
      db.apartment.create({
        data: {
          title: 'بنتهاوس فاخر - القاهرة الجديدة',
          price: 25000,
          area: 'القاهرة الجديدة',
          bedrooms: 4,
          bathrooms: 3,
          description: 'بنتهاوس فاخر مع روف خاص وجاكوزي. إطلالة بانورامية على المدينة.',
          ownerPhone: '+201019998888',
          mapLink: 'https://maps.google.com/?q=New+Cairo+Egypt',
          imageUrl: apartmentImages[6],
          images: JSON.stringify([apartmentImages[6], apartmentImages[7]]),
          amenities: JSON.stringify(['روف خاص', 'جاكوزي', 'تقنيات ذكية', 'مسبح']),
          featured: true,
          isFeatured: true,
          isVip: true,
          type: 'rent',
          status: 'available',
        }
      }),
      db.apartment.create({
        data: {
          title: 'شقة عائلية - العاصمة الإدارية',
          price: 4500000,
          area: 'العاصمة الإدارية',
          bedrooms: 3,
          bathrooms: 2,
          description: 'شقة جديدة في العاصمة الإدارية الجديدة بتشطيب فل فنشين.',
          ownerPhone: '+201147776666',
          mapLink: 'https://maps.google.com/?q=New+Administrative+Capital+Egypt',
          imageUrl: apartmentImages[0],
          images: JSON.stringify([apartmentImages[0], apartmentImages[2]]),
          amenities: JSON.stringify(['جديد', 'تشطيب كامل', 'كمباوند']),
          featured: false,
          type: 'sale',
          status: 'available',
        }
      }),
    ]);

    // Create default settings
    await db.settings.upsert({
      where: { id: 'default' },
      create: {
        id: 'default',
        contactFee: 50,
        featuredFee: 100,
        premiumFee: 200,
      },
      update: {}
    }).catch(() => {});

    return NextResponse.json({ 
      success: true,
      message: 'تم إضافة البيانات التجريبية بنجاح', 
      count: apartments.length
    });
  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json({ error: 'Failed to seed', details: String(error) }, { status: 500 });
  }
}

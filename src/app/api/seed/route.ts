import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// AI-generated apartment images (professional quality)
const aiGeneratedImages = [
  '/generated-images/apt1.png', // Modern luxury apartment
  '/generated-images/apt2.png', // Elegant villa
  '/generated-images/apt3.png', // Cozy studio
  '/generated-images/apt4.png', // Mediterranean sea view
  '/generated-images/apt5.png', // Duplex penthouse
];

// Fallback to Unsplash images
const fallbackImages = [
  'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=80',
  'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80',
  'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&q=80',
  'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800&q=80',
  'https://images.unsplash.com/photo-1507089947368-19c1da9775ae?w=800&q=80',
];

// Combined image array with AI-generated first
const apartmentImages = [...aiGeneratedImages, ...fallbackImages];

export async function GET() {
  try {
    // Clear existing data
    await db.payment.deleteMany();
    await db.inquiry.deleteMany();
    await db.apartment.deleteMany();

    // Create sample apartments with AI-generated and professional images
    const apartments = await Promise.all([
      db.apartment.create({
        data: {
          title: 'شقة فاخرة في التجمع الخامس - إطلالة حدائق',
          price: 25000,
          area: 'التجمع الخامس',
          bedrooms: 3,
          bathrooms: 2,
          description: 'شقة فاخرة بتصميم عصري على أحدث طراز، تطل على حدائق خضراء واسعة. تشطيب سوبر لوكس مع مطبخ مجهز بالكامل وأجهزة مدمجة. الموقع متميز قريب من المدارس الدولية والمولات التجارية.',
          ownerPhone: '+20 100 123 4567',
          mapLink: 'https://maps.google.com/?q=New+Cairo+Egypt',
          imageUrl: apartmentImages[0],
          images: JSON.stringify([apartmentImages[0], apartmentImages[1]]),
          amenities: JSON.stringify(['مسبح', 'نادي صحي', 'أمن 24 ساعة']),
          featured: true,
          type: 'rent',
          status: 'available',
        }
      }),
      db.apartment.create({
        data: {
          title: 'فيلا مستقلة بالمهندسين',
          price: 8500000,
          area: 'المهندسين',
          bedrooms: 5,
          bathrooms: 4,
          description: 'فيلا فاخرة مع حديقة خاصة ومسبح، موقع ممتاز في أرقى شوارع المهندسين. تصميم كلاسيكي فاخر مع تشطيبات راقية ومساحات واسعة.',
          ownerPhone: '+20 122 987 6543',
          mapLink: 'https://maps.google.com/?q=Mohandessin+Cairo',
          imageUrl: apartmentImages[1],
          images: JSON.stringify([apartmentImages[1], apartmentImages[2]]),
          amenities: JSON.stringify(['حديقة خاصة', 'مسبح خاص', 'موقف سيارات']),
          featured: true,
          type: 'sale',
          status: 'available',
        }
      }),
      db.apartment.create({
        data: {
          title: 'استوديو مودرن بالمعادي',
          price: 12000,
          area: 'المعادي',
          bedrooms: 1,
          bathrooms: 1,
          description: 'استوديو أنيق مثالي للعزاب والمحترفين، قريب من المترو والخدمات. تصميم عصري مع إضاءة طبيعية ممتازة.',
          ownerPhone: '+20 111 555 4433',
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
          description: 'شقة بإطلالة بحرية مباشرة على البحر المتوسط. بلكونة كبيرة مع إطلالة بانورامية رائعة.',
          ownerPhone: '+20 3 123 4567',
          mapLink: 'https://maps.google.com/?q=Alexandria+Egypt',
          imageUrl: apartmentImages[3],
          images: JSON.stringify([apartmentImages[3], apartmentImages[4]]),
          amenities: JSON.stringify(['إطلالة بحرية', 'بلكونة كبيرة']),
          featured: true,
          type: 'sale',
          status: 'available',
        }
      }),
      db.apartment.create({
        data: {
          title: 'دوبلكس بالسادس من أكتوبر',
          price: 18000,
          area: 'السادس من أكتوبر',
          bedrooms: 4,
          bathrooms: 3,
          description: 'دوبلكس واسع في كمباوند راقي مع حديقة خاصة. تصميم مفتوح وإضاءة طبيعية ممتازة.',
          ownerPhone: '+20 155 222 1111',
          mapLink: 'https://maps.google.com/?q=6th+October+Egypt',
          imageUrl: apartmentImages[4],
          images: JSON.stringify([apartmentImages[4], apartmentImages[5]]),
          amenities: JSON.stringify(['دوبلكس', 'كمباوند', 'أمن']),
          featured: false,
          type: 'rent',
          status: 'available',
        }
      }),
      db.apartment.create({
        data: {
          title: 'بنتهاوس فاخر - القاهرة الجديدة',
          price: 85000,
          area: 'القاهرة الجديدة',
          bedrooms: 4,
          bathrooms: 3,
          description: 'بنتهاوس فاخر مع روف خاص وجاكوزي. إطلالة بانورامية على المدينة مع أحدث التقنيات الذكية.',
          ownerPhone: '+20 101 999 8888',
          mapLink: 'https://maps.google.com/?q=New+Cairo+Egypt',
          imageUrl: apartmentImages[5],
          images: JSON.stringify([apartmentImages[5], apartmentImages[6]]),
          amenities: JSON.stringify(['روف خاص', 'جاكوزي', 'تقنيات ذكية']),
          featured: true,
          type: 'rent',
          status: 'available',
        }
      }),
      db.apartment.create({
        data: {
          title: 'شقة عائلية - مدينة نصر',
          price: 18500,
          area: 'مدينة نصر',
          bedrooms: 3,
          bathrooms: 2,
          description: 'شقة عائلية في موقع متميز قريب من جميع الخدمات والمدارس. تشطيب ممتاز.',
          ownerPhone: '+20 114 333 2222',
          mapLink: 'https://maps.google.com/?q=Nasr+City+Cairo',
          imageUrl: apartmentImages[6],
          images: JSON.stringify([apartmentImages[6]]),
          amenities: JSON.stringify(['قريب من الخدمات', 'مناسب للعائلات']),
          featured: false,
          type: 'rent',
          status: 'available',
        }
      }),
      db.apartment.create({
        data: {
          title: 'تاون هاوس - الرحاب',
          price: 7500000,
          area: 'الرحاب',
          bedrooms: 4,
          bathrooms: 3,
          description: 'تاون هاوس فاخر في كمباوند الرحاب مع حديقة خاصة وجيم وسبا.',
          ownerPhone: '+20 128 777 6666',
          mapLink: 'https://maps.google.com/?q=Rehab+City+Egypt',
          imageUrl: apartmentImages[7],
          images: JSON.stringify([apartmentImages[7], apartmentImages[0]]),
          amenities: JSON.stringify(['حديقة خاصة', 'جيم', 'سبا']),
          featured: true,
          type: 'sale',
          status: 'available',
        }
      }),
    ]);

    return NextResponse.json({ 
      message: 'Database seeded successfully with AI-generated images', 
      count: apartments.length,
      aiImages: aiGeneratedImages.length
    });
  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json({ error: 'Failed to seed', details: String(error) }, { status: 500 });
  }
}

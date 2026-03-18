import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// This endpoint initializes the database with sample data
export async function GET() {
  try {
    // Check if apartments already exist
    const existingApartments = await db.apartment.count();
    
    if (existingApartments > 0) {
      return NextResponse.json({ 
        message: 'Database already initialized',
        apartmentsCount: existingApartments 
      });
    }

    // Sample apartments data
    const sampleApartments = [
      {
        title: 'شقة فاخرة في الزمالك',
        price: 15000,
        area: 'الزمالك',
        bedrooms: 3,
        bathrooms: 2,
        description: 'شقة فاخرة بإطلالة نيلية، تشطيب سوبر لوكس، قريبة من كل الخدمات',
        ownerPhone: '01234567890',
        mapLink: 'https://maps.google.com/?q=Zamalek,Cairo',
        imageUrl: '/apartments/luxury-cairo.png',
        images: JSON.stringify(['/apartments/luxury-cairo.png']),
        amenities: JSON.stringify(['موقف سيارات', 'أمن 24 ساعة', 'مصعد', 'حديقة']),
        featured: true,
        type: 'rent',
        status: 'available',
        views: 150,
      },
      {
        title: 'شقة عائلية في المعادي',
        price: 12000,
        area: 'المعادي',
        bedrooms: 4,
        bathrooms: 3,
        description: 'شقة عائلية واسعة، حي هادئ، قريبة من المدارس والمستشفيات',
        ownerPhone: '01298765432',
        mapLink: 'https://maps.google.com/?q=Maadi,Cairo',
        imageUrl: '/apartments/family-apartment.png',
        images: JSON.stringify(['/apartments/family-apartment.png']),
        amenities: JSON.stringify(['موقف سيارات', 'أمن 24 ساعة', 'مصعد']),
        featured: false,
        type: 'rent',
        status: 'available',
        views: 89,
      },
      {
        title: 'استوديو مودرن في مدينة نصر',
        price: 8000,
        area: 'مدينة نصر',
        bedrooms: 1,
        bathrooms: 1,
        description: 'استوديو مودرن تشطيب كامل، مناسب لشباب أو زوجين',
        ownerPhone: '01123456789',
        mapLink: 'https://maps.google.com/?q=Nasr City,Cairo',
        imageUrl: '/apartments/studio-maadi.png',
        images: JSON.stringify(['/apartments/studio-maadi.png']),
        amenities: JSON.stringify(['أمن 24 ساعة', 'مصعد']),
        featured: false,
        type: 'rent',
        status: 'available',
        views: 45,
      },
      {
        title: 'فيلا في التجمع الخامس',
        price: 5000000,
        area: 'التجمع الخامس',
        bedrooms: 5,
        bathrooms: 4,
        description: 'فيلا فاخرة مع حديقة خاصة ومسبح، تشطيب سوبر لوكس',
        ownerPhone: '01098765432',
        mapLink: 'https://maps.google.com/?q=New Cairo,Egypt',
        imageUrl: '/apartments/villa-mohandessin.png',
        images: JSON.stringify(['/apartments/villa-mohandessin.png']),
        amenities: JSON.stringify(['موقف سيارات', 'حديقة', 'مسبح', 'أمن 24 ساعة']),
        featured: true,
        type: 'sale',
        status: 'available',
        views: 234,
      },
    ];

    // Create apartments
    for (const apt of sampleApartments) {
      await db.apartment.create({ data: apt });
    }

    // Create settings
    const existingSettings = await db.settings.count();
    if (existingSettings === 0) {
      await db.settings.create({
        data: {
          contactFee: 50,
          featuredFee: 100,
          premiumFee: 200,
          currency: 'ج.م',
        }
      });
    }

    return NextResponse.json({ 
      success: true,
      message: 'Database initialized successfully',
      apartmentsCreated: sampleApartments.length 
    });
  } catch (error: any) {
    console.error('Error initializing database:', error);
    return NextResponse.json({ 
      error: 'Failed to initialize database',
      details: error.message 
    }, { status: 500 });
  }
}


import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

const apartmentImages = [
  'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=80',
  'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80',
  'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&q=80',
  'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800&q=80',
];

export async function GET() {
  try {
    await db.payment.deleteMany();
    await db.inquiry.deleteMany();
    await db.apartment.deleteMany();

    const apartments = await Promise.all([
      db.apartment.create({
        data: {
          title: 'شقة فاخرة في مدينة نصر',
          price: 8500,
          area: 'مدينة نصر',
          bedrooms: 3,
          bathrooms: 2,
          description: 'شقة فاخرة بتصميم عصري.',
          ownerPhone: '+201001234567',
          mapLink: 'https://maps.google.com/?q=Nasr+City',
          imageUrl: apartmentImages[0],
          images: JSON.stringify([apartmentImages[0]]),
          amenities: JSON.stringify(['مصعد', 'أمن']),
          isFeatured: true,
          isVip: true,
          type: 'rent',
          status: 'available',
        }
      }),
      db.apartment.create({
        data: {
          title: 'فيلا بالتجمع الخامس',
          price: 15000000,
          area: 'التجمع الخامس',
          bedrooms: 5,
          bathrooms: 4,
          description: 'فيلا فاخرة مع حديقة.',
          ownerPhone: '+201229876543',
          mapLink: 'https://maps.google.com/?q=Fifth+Settlement',
          imageUrl: apartmentImages[1],
          images: JSON.stringify([apartmentImages[1]]),
          amenities: JSON.stringify(['حديقة', 'مسبح']),
          isFeatured: true,
          isVip: true,
          type: 'sale',
          status: 'available',
        }
      }),
    ]);

    await db.settings.upsert({
      where: { id: 'default' },
      create: { id: 'default', contactFee: 50, featuredFee: 100, vipFee: 200 },
      update: {}
    });

    return NextResponse.json({ success: true, count: apartments.length });
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
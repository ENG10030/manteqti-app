import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Fixed settings ID to ensure single record
const SETTINGS_ID = 'default-settings';

// Get settings
export async function GET() {
  try {
    let settings = await db.settings.findUnique({
      where: { id: SETTINGS_ID }
    });

    if (!settings) {
      settings = await db.settings.create({
        data: {
          id: SETTINGS_ID,
          contactFee: 50,
          featuredFee: 100,
          vipFee: 200,
          saleDisplayFee: 100,
          rentDisplayFee: 75,
          otherServicesFee: 50,
          highlightFee: 150,
          priorityListingFee: 200,
          verifiedListingFee: 250,
          currency: 'ج.م'
        }
      });
    }

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

// Update settings
export async function PUT(request: NextRequest) {
  try {
    const data = await request.json();

    const updateData = {
      contactFee: data.contactFee ?? 50,
      featuredFee: data.featuredFee ?? 100,
      vipFee: data.vipFee ?? 200,
      saleDisplayFee: data.saleDisplayFee ?? 100,
      rentDisplayFee: data.rentDisplayFee ?? 75,
      otherServicesFee: data.otherServicesFee ?? 50,
      highlightFee: data.highlightFee ?? 150,
      priorityListingFee: data.priorityListingFee ?? 200,
      verifiedListingFee: data.verifiedListingFee ?? 250,
      currency: data.currency ?? 'ج.م'
    };

    // Use upsert to create or update
    const settings = await db.settings.upsert({
      where: { id: SETTINGS_ID },
      create: {
        id: SETTINGS_ID,
        ...updateData
      },
      update: updateData
    });

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Error updating settings:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}

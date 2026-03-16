import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Get settings
export async function GET() {
  try {
    let settings = await db.settings.findFirst();
    
    if (!settings) {
      settings = await db.settings.create({
        data: {
          contactFee: 50,
          featuredFee: 100,
          premiumFee: 200,
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
    
    let settings = await db.settings.findFirst();
    
    if (!settings) {
      settings = await db.settings.create({
        data: {
          contactFee: data.contactFee || 50,
          featuredFee: data.featuredFee || 100,
          premiumFee: data.premiumFee || 200,
          currency: data.currency || 'ج.م'
        }
      });
    } else {
      settings = await db.settings.update({
        where: { id: settings.id },
        data: {
          contactFee: data.contactFee,
          featuredFee: data.featuredFee,
          premiumFee: data.premiumFee,
          currency: data.currency
        }
      });
    }
    
    return NextResponse.json(settings);
  } catch (error) {
    console.error('Error updating settings:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}

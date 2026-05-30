import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireDeveloper } from '@/lib/auth';

// Default settings values
const DEFAULT_SETTINGS = {
  contactFee: 50,
  regularFee: 30,
  featuredFee: 100,
  premiumFee: 200,
  vipFee: 300,
  saleDisplayFee: 100,
  rentDisplayFee: 75,
  otherServicesFee: 50,
  highlightFee: 150,
  priorityListingFee: 200,
  verifiedListingFee: 250,
  currency: 'ج.م',
};

/**
 * GET /api/settings
 * Return settings from DB. Create with defaults if not exists.
 */
export async function GET(request: NextRequest) {
  try {
    // Ensure settings row exists (create if not)
    let settings = await db.settings.findUnique({
      where: { id: 'default' },
    });

    if (!settings) {
      settings = await db.settings.create({
        data: { id: 'default', ...DEFAULT_SETTINGS },
      });
    }

    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء تحميل الإعدادات' }, { status: 500 });
  }
}

/**
 * PUT /api/settings
 * Require developer auth. Use upsert to properly save ALL settings fields.
 * Returns the saved settings directly (no re-read to avoid caching issues).
 */
export async function PUT(request: NextRequest) {
  try {
    const decoded = await requireDeveloper(request);
    if (decoded instanceof Response) return decoded;

    const body = await request.json();

    // Use upsert: creates if not exists, updates if exists
    const settings = await db.settings.upsert({
      where: { id: 'default' },
      update: {
        contactFee: body.contactFee ?? DEFAULT_SETTINGS.contactFee,
        regularFee: body.regularFee ?? DEFAULT_SETTINGS.regularFee,
        featuredFee: body.featuredFee ?? DEFAULT_SETTINGS.featuredFee,
        premiumFee: body.premiumFee ?? DEFAULT_SETTINGS.premiumFee,
        vipFee: body.vipFee ?? DEFAULT_SETTINGS.vipFee,
        saleDisplayFee: body.saleDisplayFee ?? DEFAULT_SETTINGS.saleDisplayFee,
        rentDisplayFee: body.rentDisplayFee ?? DEFAULT_SETTINGS.rentDisplayFee,
        otherServicesFee: body.otherServicesFee ?? DEFAULT_SETTINGS.otherServicesFee,
        highlightFee: body.highlightFee ?? DEFAULT_SETTINGS.highlightFee,
        priorityListingFee: body.priorityListingFee ?? DEFAULT_SETTINGS.priorityListingFee,
        verifiedListingFee: body.verifiedListingFee ?? DEFAULT_SETTINGS.verifiedListingFee,
        currency: body.currency ?? DEFAULT_SETTINGS.currency,
      },
      create: {
        id: 'default',
        contactFee: body.contactFee ?? DEFAULT_SETTINGS.contactFee,
        regularFee: body.regularFee ?? DEFAULT_SETTINGS.regularFee,
        featuredFee: body.featuredFee ?? DEFAULT_SETTINGS.featuredFee,
        premiumFee: body.premiumFee ?? DEFAULT_SETTINGS.premiumFee,
        vipFee: body.vipFee ?? DEFAULT_SETTINGS.vipFee,
        saleDisplayFee: body.saleDisplayFee ?? DEFAULT_SETTINGS.saleDisplayFee,
        rentDisplayFee: body.rentDisplayFee ?? DEFAULT_SETTINGS.rentDisplayFee,
        otherServicesFee: body.otherServicesFee ?? DEFAULT_SETTINGS.otherServicesFee,
        highlightFee: body.highlightFee ?? DEFAULT_SETTINGS.highlightFee,
        priorityListingFee: body.priorityListingFee ?? DEFAULT_SETTINGS.priorityListingFee,
        verifiedListingFee: body.verifiedListingFee ?? DEFAULT_SETTINGS.verifiedListingFee,
        currency: body.currency ?? DEFAULT_SETTINGS.currency,
      },
    });

    // Log settings update
    try {
      await db.operationLog.create({
        data: {
          action: 'SETTINGS_UPDATED',
          entityType: 'Settings',
          entityId: 'default',
          details: JSON.stringify({ changedBy: decoded.identifier, settings }),
          userId: decoded.id,
        },
      });
    } catch {}

    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Error updating settings:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء تحديث الإعدادات' }, { status: 500 });
  }
}

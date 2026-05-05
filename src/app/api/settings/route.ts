import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verify } from "jsonwebtoken";
import { notifyRealtime } from "@/lib/realtime";

const JWT_SECRET = process.env.JWT_SECRET || "manteqti-secret-key-2024";
const DEVELOPER_EMAIL = process.env.DEVELOPER_EMAIL || "ahmadmamdouh10030@gmail.com";

async function isDeveloper(request: Request): Promise<boolean> {
  const cookieHeader = request.headers.get("cookie");
  const cookies = new URLSearchParams(cookieHeader?.replace(/; /g, "&") || "");
  const token = cookies.get("auth-token");

  if (!token) return false;

  try {
    const decoded = verify(token, JWT_SECRET) as { userId: string; role?: string; identifier?: string };
    
    if (decoded.role === "DEVELOPER" || decoded.identifier === DEVELOPER_EMAIL) return true;

    const user = await db.user.findUnique({
      where: { id: decoded.userId },
      select: { role: true, identifier: true },
    });

    return user?.role === "DEVELOPER" || user?.identifier === DEVELOPER_EMAIL;
  } catch {
    return false;
  }
}

async function getCurrentUserId(request: Request): Promise<string | null> {
  const cookieHeader = request.headers.get("cookie");
  const cookies = new URLSearchParams(cookieHeader?.replace(/; /g, "&") || "");
  const token = cookies.get("auth-token");

  if (!token) return null;

  try {
    const decoded = verify(token, JWT_SECRET) as { userId: string };
    return decoded.userId;
  } catch {
    return null;
  }
}

// Validate fee value - must be non-negative integer
function validateFee(value: any): number {
  const num = parseInt(value);
  if (isNaN(num) || num < 0) return 0;
  return num;
}

// Validate currency - max 10 chars, no HTML
function validateCurrency(value: any): string {
  if (typeof value !== 'string') return 'ج.م';
  const sanitized = value.replace(/<[^>]*>/g, '').trim().slice(0, 10);
  return sanitized || 'ج.م';
}

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
  currency: "ج.م",
};

// Helper: format settings for response (strip nulls, etc.)
function formatSettings(s: any) {
  return {
    contactFee: s.contactFee ?? 50,
    regularFee: s.regularFee ?? 30,
    featuredFee: s.featuredFee ?? 100,
    premiumFee: s.premiumFee ?? 200,
    vipFee: s.vipFee ?? 300,
    saleDisplayFee: s.saleDisplayFee ?? 100,
    rentDisplayFee: s.rentDisplayFee ?? 75,
    otherServicesFee: s.otherServicesFee ?? 50,
    highlightFee: s.highlightFee ?? 150,
    priorityListingFee: s.priorityListingFee ?? 200,
    verifiedListingFee: s.verifiedListingFee ?? 250,
    currency: s.currency ?? 'ج.م',
  };
}

// GET - جلب الإعدادات (public - all users can read)
// For regular users: returns published fees if available, otherwise current fees
// For developer: always returns current (draft) fees
export async function GET(request: Request) {
  try {
    let settings = await db.settings.findFirst();

    if (!settings) {
      settings = await db.settings.create({ data: DEFAULT_SETTINGS });
    }

    const devRequest = await isDeveloper(request);

    // If there are published fees and this is NOT a developer request, return published fees
    if (!devRequest && settings.publishedFees) {
      try {
        const published = JSON.parse(settings.publishedFees);
        return NextResponse.json(
          { settings: formatSettings(published), isPublished: true },
          { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate', 'Pragma': 'no-cache' } }
        );
      } catch {
        // If publishedFees is corrupted, fall through to current settings
      }
    }

    return NextResponse.json(
      { settings: formatSettings(settings), isPublished: false },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate', 'Pragma': 'no-cache' } }
    );
  } catch (error) {
    console.error("Get settings error:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء جلب الإعدادات" },
      { status: 500 }
    );
  }
}

// PUT - تحديث الإعدادات (developer only)
export async function PUT(request: Request) {
  try {
    if (!(await isDeveloper(request))) {
      return NextResponse.json({ error: "غير مصرح لك" }, { status: 403 });
    }

    const body = await request.json();

    // Server-side validation
    const validatedData = {
      contactFee: validateFee(body.contactFee),
      regularFee: validateFee(body.regularFee),
      featuredFee: validateFee(body.featuredFee),
      premiumFee: validateFee(body.premiumFee),
      vipFee: validateFee(body.vipFee),
      saleDisplayFee: validateFee(body.saleDisplayFee),
      rentDisplayFee: validateFee(body.rentDisplayFee),
      otherServicesFee: validateFee(body.otherServicesFee),
      highlightFee: validateFee(body.highlightFee),
      priorityListingFee: validateFee(body.priorityListingFee),
      verifiedListingFee: validateFee(body.verifiedListingFee),
      currency: validateCurrency(body.currency),
    };

    let settings = await db.settings.findFirst();

    if (!settings) {
      settings = await db.settings.create({ data: validatedData });
    } else {
      settings = await db.settings.update({
        where: { id: settings.id },
        data: validatedData,
      });
    }

    // Log settings change
    const currentUserId = await getCurrentUserId(request);
    try {
      await db.operationLog.create({
        data: {
          action: 'UPDATE_SETTINGS',
          entityType: 'Settings',
          entityId: settings.id,
          userId: currentUserId,
          details: JSON.stringify(validatedData),
        },
      });
    } catch {}

    // Do NOT notify regular users about settings change - only developer sees the update
    // The developer must explicitly publish for users to see changes

    return NextResponse.json({
      message: "تم تحديث الإعدادات بنجاح (مسودة)",
      settings: formatSettings(settings),
    });
  } catch (error) {
    console.error("Update settings error:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء تحديث الإعدادات" },
      { status: 500 }
    );
  }
}

// POST - نشر الإعدادات للمستخدمين (developer only)
// This copies current settings to publishedFees so users see the changes
export async function POST(request: Request) {
  try {
    if (!(await isDeveloper(request))) {
      return NextResponse.json({ error: "غير مصرح لك" }, { status: 403 });
    }

    let settings = await db.settings.findFirst();

    if (!settings) {
      settings = await db.settings.create({ data: DEFAULT_SETTINGS });
    }

    // Create published snapshot of current fees
    const publishedFees = JSON.stringify(formatSettings(settings));

    settings = await db.settings.update({
      where: { id: settings.id },
      data: { publishedFees },
    });

    // Notify all connected clients about settings change
    notifyRealtime('settings-updated', formatSettings(settings));

    // Log publish action
    const currentUserId = await getCurrentUserId(request);
    try {
      await db.operationLog.create({
        data: {
          action: 'PUBLISH_SETTINGS',
          entityType: 'Settings',
          entityId: settings.id,
          userId: currentUserId,
          details: publishedFees,
        },
      });
    } catch {}

    return NextResponse.json({
      message: "تم نشر الإعدادات للمستخدمين بنجاح ✅",
      settings: formatSettings(settings),
    });
  } catch (error) {
    console.error("Publish settings error:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء نشر الإعدادات" },
      { status: 500 }
    );
  }
}

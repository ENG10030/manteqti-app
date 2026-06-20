import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verify } from "jsonwebtoken";
import { notifyRealtime } from "@/lib/realtime";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is not configured');
}
const DEVELOPER_EMAIL = process.env.DEVELOPER_EMAIL || "ahmadmamdouh10030@gmail.com";

async function isDeveloper(request: Request): Promise<boolean> {
  const cookieHeader = request.headers.get("cookie");
  const cookies = new URLSearchParams(cookieHeader?.replace(/; /g, "&") || "");
  const token = cookies.get("auth-token");

  if (!token) return false;

  try {
    const decoded = verify(token, JWT_SECRET!) as unknown as { userId: string; role?: string; identifier?: string };
    
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
    const decoded = verify(token, JWT_SECRET!) as unknown as { userId: string };
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

// GET - جلب الإعدادات (public - all users see the same current settings)
// Supports efficient polling via ?since=timestamp parameter
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const since = searchParams.get('since');

    let settings = await db.settings.findFirst();

    if (!settings) {
      settings = await db.settings.create({ data: DEFAULT_SETTINGS });
    }

    // Efficient polling: if client provides 'since' and settings haven't changed, return 304
    if (since) {
      const sinceDate = new Date(since);
      if (settings.updatedAt && !isNaN(sinceDate.getTime()) && settings.updatedAt <= sinceDate) {
        return new NextResponse(null, { status: 304 });
      }
    }

    return NextResponse.json(
      { 
        settings: {
          ...settings,
          // Ensure updatedAt is always an ISO string
          updatedAt: settings.updatedAt?.toISOString() || new Date().toISOString(),
        }
      },
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

// PUT - تحديث الإعدادات (developer only) - changes take effect immediately for ALL users
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

    // Notify ALL connected clients about settings change immediately
    notifyRealtime('settings-updated', validatedData);

    return NextResponse.json({
      message: "تم تحديث الإعدادات بنجاح ✅",
      settings,
    });
  } catch (error) {
    console.error("Update settings error:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء تحديث الإعدادات" },
      { status: 500 }
    );
  }
}

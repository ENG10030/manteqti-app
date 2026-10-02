import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verify } from "jsonwebtoken";
import { isValidId } from "@/lib/auth-middleware";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET environment variable is required');

// ============================================================
// مستندات إثبات الملكية — Endpoint الوحيد الذي يُرجع الصور
// ⛔ SECURITY: الوصول للمالك (صاحب العقار) أو المطور حصراً
// ============================================================

async function getCurrentUser(request: Request) {
  const cookieHeader = request.headers.get("cookie");
  const cookies = new URLSearchParams(cookieHeader?.replace(/; /g, "&") || "");
  const token = cookies.get("auth-token");
  if (!token) return null;
  try {
    const decoded = verify(token, JWT_SECRET!) as unknown as { userId: string };
    return await db.user.findUnique({ where: { id: decoded.userId } });
  } catch {
    return null;
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!isValidId(id)) {
      return NextResponse.json({ error: "معرف غير صالح" }, { status: 400 });
    }

    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: "يجب تسجيل الدخول" }, { status: 401 });
    }

    const apartment = await db.apartment.findUnique({
      where: { id },
      select: { id: true, createdBy: true },
    });
    if (!apartment) {
      return NextResponse.json({ error: "العقار غير موجود" }, { status: 404 });
    }

    // ⛔ SECURITY: المطور أو صاحب العقار فقط
    const isDeveloper = user.role === "DEVELOPER";
    const isOwner = apartment.createdBy === user.id;
    if (!isDeveloper && !isOwner) {
      return NextResponse.json({ error: "غير مصرح لك بمشاهدة مستندات الملكية" }, { status: 403 });
    }

    const doc = await db.ownershipDocument.findUnique({
      where: { apartmentId: id },
      select: {
        contractImage: true,
        ownerIdCardImage: true,
        hasContract: true,
        hasIdCard: true,
        verified: true,
        verifiedAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(
      {
        apartmentId: id,
        contractImage: doc?.contractImage || null,
        ownerIdCardImage: doc?.ownerIdCardImage || null,
        hasContract: doc?.hasContract || false,
        hasIdCard: doc?.hasIdCard || false,
        verified: doc?.verified || false,
        verifiedAt: doc?.verifiedAt || null,
        uploadedAt: doc?.updatedAt || null,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error("Get ownership documents error:", error);
    return NextResponse.json({ error: "حدث خطأ أثناء جلب المستندات" }, { status: 500 });
  }
}

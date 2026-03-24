import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verify } from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "manteqti-secret-key-2024";

async function getCurrentUser(request: Request) {
  const cookieHeader = request.headers.get("cookie");
  const cookies = new URLSearchParams(cookieHeader?.replace(/; /g, "&") || "");
  const token = cookies.get("auth-token");

  if (!token) return null;

  try {
    const decoded = verify(token, JWT_SECRET) as { userId: string };
    return await db.user.findUnique({
      where: { id: decoded.userId },
    });
  } catch {
    return null;
  }
}

// GET - جلب عقار واحد
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const apartment = await db.apartment.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, name: true, phone: true, email: true },
        },
      },
    });

    if (!apartment) {
      return NextResponse.json({ error: "العقار غير موجود" }, { status: 404 });
    }

    return NextResponse.json({ apartment });
  } catch (error) {
    console.error("Get apartment error:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء جلب العقار" },
      { status: 500 }
    );
  }
}

// PUT - تحديث عقار
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: "يجب تسجيل الدخول" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const apartment = await db.apartment.findUnique({
      where: { id },
    });

    if (!apartment) {
      return NextResponse.json({ error: "العقار غير موجود" }, { status: 404 });
    }

    if (apartment.createdBy !== user.id && user.role !== "DEVELOPER") {
      return NextResponse.json({ error: "غير مصرح لك" }, { status: 403 });
    }

    const updatedApartment = await db.apartment.update({
      where: { id },
      data: {
        title: body.title,
        description: body.description,
        price: body.price ? parseFloat(body.price) : undefined,
        area: body.area,
        bedrooms: body.bedrooms ? parseInt(body.bedrooms) : undefined,
        bathrooms: body.bathrooms ? parseInt(body.bathrooms) : undefined,
        type: body.type,
        images: body.images,
        ownerPhone: body.ownerPhone,
        mapLink: body.mapLink,
        status: body.status,
        isFeatured: body.isFeatured,
        isVip: body.isVip,
      },
    });

    return NextResponse.json({
      message: "تم تحديث العقار بنجاح",
      apartment: updatedApartment,
    });
  } catch (error) {
    console.error("Update apartment error:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء تحديث العقار" },
      { status: 500 }
    );
  }
}

// PATCH - الموافقة/التمييز/الرفض
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request);
    if (!user || user.role !== "DEVELOPER") {
      return NextResponse.json({ error: "غير مصرح لك" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { action, isFeatured } = body;

    const apartment = await db.apartment.findUnique({
      where: { id },
    });

    if (!apartment) {
      return NextResponse.json({ error: "العقار غير موجود" }, { status: 404 });
    }

    let updateData: any = {};

    if (action === "approve") {
      updateData.status = "available";
    } else if (action === "reject") {
      updateData.status = "rejected";
    } else if (action === "feature") {
      updateData.isFeatured = isFeatured !== undefined ? isFeatured : true;
    } else {
      if (isFeatured !== undefined) updateData.isFeatured = isFeatured;
    }

    const updatedApartment = await db.apartment.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      message: "تم تحديث العقار بنجاح",
      apartment: updatedApartment,
    });
  } catch (error) {
    console.error("Patch apartment error:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء تحديث العقار" },
      { status: 500 }
    );
  }
}

// DELETE - حذف عقار
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: "يجب تسجيل الدخول" }, { status: 401 });
    }

    const { id } = await params;

    const apartment = await db.apartment.findUnique({
      where: { id },
    });

    if (!apartment) {
      return NextResponse.json({ error: "العقار غير موجود" }, { status: 404 });
    }

    if (apartment.createdBy !== user.id && user.role !== "DEVELOPER") {
      return NextResponse.json({ error: "غير مصرح لك" }, { status: 403 });
    }

    await db.apartment.delete({
      where: { id },
    });

    return NextResponse.json({ message: "تم حذف العقار بنجاح" });
  } catch (error) {
    console.error("Delete apartment error:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء حذف العقار" },
      { status: 500 }
    );
  }
}
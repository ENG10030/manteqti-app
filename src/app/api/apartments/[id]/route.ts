import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verify } from "jsonwebtoken";
import { notifyApartmentsChanged } from "@/lib/realtime";
import { sendApartmentApprovedEmail, sendApartmentRejectedEmail } from "@/lib/email";
import { JWT_SECRET } from "@/lib/auth";

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

// GET - fetch single apartment
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
          // SECURITY: Do not expose phone/email in public response
          select: { id: true, name: true },
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

// PUT - update apartment (owner or developer)
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

    // Ownership check
    if (apartment.createdBy !== user.id && user.role !== "DEVELOPER") {
      return NextResponse.json({ error: "غير مصرح لك" }, { status: 403 });
    }

    const isDeveloper = user.role === 'DEVELOPER';

    // SECURITY: Build update data explicitly (prevent mass assignment)
    const updateData: Record<string, unknown> = {};
    
    // Fields all authenticated owners can update
    if (body.title !== undefined) updateData.title = body.title;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.area !== undefined) updateData.area = body.area;
    if (body.bedrooms !== undefined) updateData.bedrooms = body.bedrooms ? parseInt(body.bedrooms) : undefined;
    if (body.bathrooms !== undefined) updateData.bathrooms = body.bathrooms ? parseInt(body.bathrooms) : undefined;
    if (body.floor !== undefined) updateData.floor = body.floor !== null ? parseInt(body.floor) : null;
    if (body.apartmentSize !== undefined) updateData.apartmentSize = body.apartmentSize !== null ? parseInt(body.apartmentSize) : null;
    if (body.type !== undefined) updateData.type = body.type;
    if (body.images !== undefined) updateData.images = body.images;
    if (body.ownerPhone !== undefined) updateData.ownerPhone = body.ownerPhone;
    if (body.mapLink !== undefined) updateData.mapLink = body.mapLink;
    if (body.price !== undefined) updateData.price = body.price ? parseFloat(body.price) : undefined;
    
    // Developer-only fields
    if (isDeveloper) {
      if (body.status !== undefined) updateData.status = body.status;
      if (body.isFeatured !== undefined) updateData.isFeatured = body.isFeatured;
      if (body.isVip !== undefined) updateData.isVip = body.isVip;
    }
    // SECURITY: statusChangedAt removed - only set server-side

    const updatedApartment = await db.apartment.update({
      where: { id },
      data: updateData,
    });

    notifyApartmentsChanged('updated', id);

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

// PATCH - approve/feature/reject (developer only)
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

    notifyApartmentsChanged('approved', id);

    if (apartment.createdBy) {
      const owner = await db.user.findUnique({ where: { id: apartment.createdBy }, select: { name: true, email: true } });
      if (owner?.email && process.env.RESEND_API_KEY) {
        if (action === 'approve') {
          sendApartmentApprovedEmail({ to: owner.email, name: owner.name, apartmentTitle: apartment.title, apartmentType: apartment.type, price: apartment.price, area: apartment.area });
        } else if (action === 'reject') {
          sendApartmentRejectedEmail({ to: owner.email, name: owner.name, apartmentTitle: apartment.title });
        }
      }
    }

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

// DELETE - delete apartment (owner or developer)
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

    // Ownership check
    if (apartment.createdBy !== user.id && user.role !== "DEVELOPER") {
      return NextResponse.json({ error: "غير مصرح لك" }, { status: 403 });
    }

    await db.apartment.delete({
      where: { id },
    });

    notifyApartmentsChanged('deleted', id);

    return NextResponse.json({ message: "تم حذف العقار بنجاح" });
  } catch (error) {
    console.error("Delete apartment error:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء حذف العقار" },
      { status: 500 }
    );
  }
}

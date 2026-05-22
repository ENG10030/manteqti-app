import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verify } from "jsonwebtoken";
import { notifyApartmentsChanged } from "@/lib/realtime";
import { sendApartmentApprovedEmail, sendApartmentRejectedEmail } from "@/lib/email";

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

    // Handle approve/reject actions (backward compatibility)
    if (body.action === 'approve' && user.role === 'DEVELOPER') {
      const updatedApartment = await db.apartment.update({
        where: { id },
        data: { status: 'available', approvedBy: user.id, approvedAt: new Date() },
      });
      notifyApartmentsChanged('approved', id);
      try {
        await db.operationLog.create({ data: { action: 'APPROVE_APARTMENT', entityType: 'Apartment', entityId: id, details: JSON.stringify({ title: apartment.title }), userId: user.id } });
      } catch {}
      return NextResponse.json({ message: 'تمت الموافقة على العقار ✅', apartment: updatedApartment });
    }
    if (body.action === 'reject' && user.role === 'DEVELOPER') {
      const updatedApartment = await db.apartment.update({
        where: { id },
        data: { status: 'rejected' },
      });
      notifyApartmentsChanged('rejected', id);
      try {
        await db.operationLog.create({ data: { action: 'REJECT_APARTMENT', entityType: 'Apartment', entityId: id, details: JSON.stringify({ title: apartment.title }), userId: user.id } });
      } catch {}
      return NextResponse.json({ message: 'تم رفض العقار ✅', apartment: updatedApartment });
    }

    // Prevent non-developers from setting privileged fields
    if (user.role !== 'DEVELOPER') {
      delete body.isFeatured;
      delete body.isVip;
      delete body.status;
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
        floor: body.floor !== undefined && body.floor !== null ? parseInt(body.floor) : null,
        apartmentSize: body.apartmentSize !== undefined && body.apartmentSize !== null ? parseInt(body.apartmentSize) : null,
        type: body.type,
        images: body.images,
        ownerPhone: body.ownerPhone,
        mapLink: body.mapLink,
        status: body.status,
        statusChangedAt: body.statusChangedAt ? new Date(body.statusChangedAt) : undefined,
        isFeatured: body.isFeatured,
        isVip: body.isVip,
      },
    });

    // Notify all connected clients
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
      updateData.approvedBy = user.id;
      updateData.approvedAt = new Date();
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

    // Log operation
    try {
      await db.operationLog.create({
        data: {
          action: action === 'approve' ? 'APPROVE_APARTMENT' : action === 'reject' ? 'REJECT_APARTMENT' : 'UPDATE_APARTMENT',
          entityType: 'Apartment',
          entityId: id,
          details: JSON.stringify({ title: apartment.title, action, status: updateData.status }),
          userId: user.id
        }
      });
    } catch {}

    // Notify all connected clients
    if (action === 'approve') {
      notifyApartmentsChanged('approved', id);
    } else if (action === 'reject') {
      notifyApartmentsChanged('rejected', id);
    } else if (action === 'feature') {
      notifyApartmentsChanged('featured', id);
    } else {
      notifyApartmentsChanged('updated', id);
    }

    // Send email notification to apartment owner
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

    // Notify all connected clients
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
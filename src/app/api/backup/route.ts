import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verify } from "jsonwebtoken";
import { cookies } from "next/headers";

const JWT_SECRET = process.env.JWT_SECRET || "";

async function verifyDeveloper(request: Request): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth-token")?.value;
    if (!token) return false;
    const decoded = verify(token, JWT_SECRET) as { role?: string };
    return decoded.role === "DEVELOPER";
  } catch {
    return false;
  }
}

// GET - Export all data as JSON backup
export async function GET(request: NextRequest) {
  try {
    if (!(await verifyDeveloper(request))) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const [users, apartments, inquiries, payments, messages, likes, comments, blockedUsers, settings, editRequests, approvalLogs, operationLogs] = await Promise.all([
      db.user.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, identifier: true, name: true, email: true, phone: true, role: true, isBlocked: true, blockedAt: true, blockReason: true, isApproved: true, emailVerified: true, otp: true, otpExpires: true, passwordResetToken: true, passwordResetExpires: true, createdAt: true, updatedAt: true } }),
      db.apartment.findMany({ orderBy: { createdAt: "asc" } }),
      db.inquiry.findMany({ orderBy: { createdAt: "asc" } }),
      db.payment.findMany({ orderBy: { createdAt: "asc" } }),
      db.message.findMany({ orderBy: { createdAt: "asc" } }),
      db.like.findMany({ orderBy: { createdAt: "asc" } }),
      db.comment.findMany({ orderBy: { createdAt: "asc" } }),
      db.blockedUser.findMany({ orderBy: { blockedAt: "asc" } }),
      db.settings.findMany(),
      db.propertyEditRequest.findMany({ orderBy: { createdAt: "asc" } }),
      db.approvalLog.findMany({ orderBy: { createdAt: "asc" } }),
      db.operationLog.findMany({ orderBy: { createdAt: "asc" } }),
    ]);

    const backup = {
      version: "v71",
      exportedAt: new Date().toISOString(),
      counts: {
        users: users.length,
        apartments: apartments.length,
        inquiries: inquiries.length,
        payments: payments.length,
        messages: messages.length,
        likes: likes.length,
        comments: comments.length,
        blockedUsers: blockedUsers.length,
        editRequests: editRequests.length,
        approvalLogs: approvalLogs.length,
        operationLogs: operationLogs.length,
      },
      data: {
        users,
        apartments,
        inquiries,
        payments,
        messages,
        likes,
        comments,
        blockedUsers,
        settings,
        editRequests,
        approvalLogs,
        operationLogs,
      },
    };

    return new NextResponse(JSON.stringify(backup, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="manteqti-backup-${new Date().toISOString().split("T")[0]}.json"`,
        "Cache-Control": "no-cache",
      },
    });
  } catch (error: any) {
    console.error("Backup error:", error);
    return NextResponse.json({ error: "فشل التصدير", details: error.message }, { status: 500 });
  }
}

// POST - Restore data from JSON backup
export async function POST(request: NextRequest) {
  try {
    if (!(await verifyDeveloper(request))) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const body = await request.json();
    const { data, mode } = body; // mode: "merge" (default) or "replace"

    if (!data) {
      return NextResponse.json({ error: "البيانات مطلوبة" }, { status: 400 });
    }

    const results: Record<string, number> = {};

    // Restore users
    if (data.users?.length) {
      for (const user of data.users) {
        const existing = await db.user.findUnique({ where: { identifier: user.identifier } });
        if (existing) {
          // Update existing user but keep password if new one looks hashed
        // 🔒 حماية: لا تسمح بتغيير role من خلال الـ backup
        // Keep the existing role unless it's a new user
          await db.user.update({
            where: { id: existing.id },
            data: {
              name: user.name,
              email: user.email,
              phone: user.phone,
              // role: لا يتم تغييره عبر الـ backup
              isBlocked: user.isBlocked,
              isApproved: user.isApproved,
              emailVerified: user.emailVerified,
              blockReason: user.blockReason,
            },
          });
        } else {
          await db.user.create({
            data: {
              id: user.id,
              identifier: user.identifier,
              name: user.name,
              email: user.email,
              phone: user.phone,
              password: user.password,
              role: user.role,
              isBlocked: user.isBlocked,
              isApproved: user.isApproved,
              emailVerified: user.emailVerified,
              blockReason: user.blockReason,
              createdAt: new Date(user.createdAt),
            },
          });
        }
      }
      results.users = data.users.length;
    }

    // Restore apartments
    if (data.apartments?.length) {
      for (const apt of data.apartments) {
        const existing = await db.apartment.findUnique({ where: { id: apt.id } });
        if (!existing) {
          await db.apartment.create({
            data: {
              id: apt.id,
              title: apt.title,
              price: apt.price,
              area: apt.area,
              bedrooms: apt.bedrooms,
              bathrooms: apt.bathrooms,
              floor: apt.floor,
              apartmentSize: apt.apartmentSize,
              description: apt.description,
              ownerPhone: apt.ownerPhone,
              mapLink: apt.mapLink,
              imageUrl: apt.imageUrl,
              images: apt.images,
              videoUrl: apt.videoUrl,
              videos: apt.videos,
              amenities: apt.amenities,
              isFeatured: apt.isFeatured,
              isVip: apt.isVip,
              type: apt.type,
              status: apt.status,
              statusChangedAt: apt.statusChangedAt ? new Date(apt.statusChangedAt) : null,
              paymentRef: apt.paymentRef,
              createdBy: apt.createdBy,
              approvedBy: apt.approvedBy,
              approvedAt: apt.approvedAt ? new Date(apt.approvedAt) : null,
              contactHidden: apt.contactHidden,
              views: apt.views,
              createdAt: new Date(apt.createdAt),
            },
          });
        }
      }
      results.apartments = data.apartments.length;
    }

    // Restore settings
    if (data.settings?.length) {
      for (const s of data.settings) {
        const existing = await db.settings.findFirst();
        if (existing) {
          await db.settings.update({ where: { id: existing.id }, data: { ...s, id: existing.id } });
        } else {
          await db.settings.create({ data: s });
        }
      }
      results.settings = data.settings.length;
    }

    return NextResponse.json({
      success: true,
      message: "تم استعادة البيانات بنجاح",
      restored: results,
      totalRestored: Object.values(results).reduce((a, b) => a + b, 0),
    });
  } catch (error: any) {
    console.error("Restore error:", error);
    return NextResponse.json({ error: "فشل الاستعادة", details: error.message }, { status: 500 });
  }
}

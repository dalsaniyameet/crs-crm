import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

async function getAdminStatus(userId: string): Promise<{ email: string; isAdmin: boolean }> {
  try {
    const dbUser = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { email: true, role: true },
    });
    return {
      email: dbUser?.email || "",
      isAdmin: dbUser?.role?.toUpperCase() === "ADMIN",
    };
  } catch {
    return { email: "", isAdmin: false };
  }
}

async function getEmpByEmail(email: string) {
  let emp = await prisma.employeeProfile.findUnique({ where: { email } });
  if (!emp) {
    const dbUser = await prisma.user.findFirst({ where: { email } });
    if (dbUser) {
      emp = await prisma.employeeProfile.upsert({
        where:  { email },
        update: {},
        create: { name: dbUser.name || email.split("@")[0], email, position: dbUser.role || "BROKER", role: dbUser.role || "BROKER", dob: new Date("2000-01-01") },
      });
    }
  }
  return emp;
}

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json([], { status: 401 });

    const { email, isAdmin } = await getAdminStatus(userId);
    const allParam   = new URL(req.url).searchParams.get("all");
    const empIdParam = new URL(req.url).searchParams.get("employeeId");

    if (isAdmin && allParam === "true") {
      const docs = await prisma.employeeDocument.findMany({ orderBy: { createdAt: "desc" } });
      return NextResponse.json(docs);
    }
    if (isAdmin && empIdParam) {
      const docs = await prisma.employeeDocument.findMany({ where: { employeeId: empIdParam }, orderBy: { createdAt: "desc" } });
      return NextResponse.json(docs);
    }
    const emp = await getEmpByEmail(email);
    if (!emp) return NextResponse.json([]);
    const docs = await prisma.employeeDocument.findMany({ where: { employeeId: emp.id }, orderBy: { createdAt: "desc" } });
    return NextResponse.json(docs);
  } catch (err: any) {
    return NextResponse.json([], { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { email, isAdmin } = await getAdminStatus(userId);
    const body = await req.json();
    const { name, type, url, notes, employeeId: targetEmpId } = body;
    if (!name || !url) return NextResponse.json({ error: "name and url required" }, { status: 400 });

    let emp;
    if (isAdmin && targetEmpId) {
      emp = await prisma.employeeProfile.findUnique({ where: { id: targetEmpId } });
    } else {
      emp = await getEmpByEmail(email);
    }
    if (!emp) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

    const doc = await prisma.employeeDocument.create({
      data: {
        employeeId: emp.id, name, type: type || "OTHER", url,
        notes: notes || null,
        status: isAdmin ? "APPROVED" : "PENDING",
        uploadedBy: isAdmin ? "ADMIN" : "EMPLOYEE",
      },
    });

    if (!isAdmin) {
      try {
        const admins = await prisma.user.findMany({ where: { role: "ADMIN", isActive: true } });
        await Promise.all(admins.map(admin =>
          prisma.notification.create({
            data: { userId: admin.id, type: "SYSTEM", title: `📄 Document Uploaded — ${emp!.name}`, message: `${emp!.name} uploaded "${name}"` },
          })
        ));
      } catch { }
    }
    return NextResponse.json(doc, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { isAdmin } = await getAdminStatus(userId);
    if (!isAdmin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

    const { id, status, adminNote } = await req.json();
    if (!id || !["APPROVED", "REJECTED"].includes(status))
      return NextResponse.json({ error: "id and valid status required" }, { status: 400 });

    const doc = await prisma.employeeDocument.update({ where: { id }, data: { status, adminNote: adminNote || null } });
    try {
      const emp = await prisma.employeeProfile.findUnique({ where: { id: doc.employeeId } });
      if (emp) {
        const empUser = await prisma.user.findFirst({ where: { email: emp.email } });
        if (empUser) {
          await prisma.notification.create({
            data: {
              userId: empUser.id, type: "SYSTEM",
              title: status === "APPROVED" ? `✅ Document Approved — ${doc.name}` : `❌ Document Rejected — ${doc.name}`,
              message: adminNote || (status === "APPROVED" ? "Your document has been approved." : "Your document was rejected."),
            },
          });
        }
      }
    } catch { }
    return NextResponse.json(doc);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    await prisma.employeeDocument.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

async function getEmpByEmail(email: string) {
  let emp = await prisma.employeeProfile.findUnique({ where: { email } });
  if (!emp) {
    const dbUser = await prisma.user.findFirst({ where: { email } });
    if (dbUser) {
      emp = await prisma.employeeProfile.upsert({
        where: { email },
        update: {},
        create: { name: dbUser.name || email.split("@")[0], email, position: dbUser.role || "BROKER", role: dbUser.role || "BROKER", dob: new Date("2000-01-01") },
      });
    }
  }
  return emp;
}

// GET — employee: own docs | admin: by employeeId query param
export async function GET(req: NextRequest) {
  const { userId } = auth();
  if (!userId) return NextResponse.json([], { status: 401 });

  const clerkUser = await clerkClient.users.getUser(userId);
  const email = clerkUser.emailAddresses[0]?.emailAddress || "";
  const isAdmin = (clerkUser.publicMetadata?.role as string)?.toUpperCase() === "ADMIN";
  const empIdParam = new URL(req.url).searchParams.get("employeeId");
  const allParam   = new URL(req.url).searchParams.get("all");

  // Admin fetching all docs
  if (isAdmin && allParam === "true") {
    const docs = await prisma.employeeDocument.findMany({ orderBy: { createdAt: "desc" } });
    return NextResponse.json(docs);
  }

  let employeeId: string | null = null;
  if (isAdmin && empIdParam) {
    employeeId = empIdParam;
  } else {
    const emp = await getEmpByEmail(email);
    employeeId = emp?.id || null;
  }

  if (!employeeId) return NextResponse.json([]);

  const docs = await prisma.employeeDocument.findMany({
    where: { employeeId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(docs);
}

// POST — employee or admin uploads a document
export async function POST(req: NextRequest) {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clerkUser = await clerkClient.users.getUser(userId);
  const email = clerkUser.emailAddresses[0]?.emailAddress || "";
  const isAdmin = (clerkUser.publicMetadata?.role as string)?.toUpperCase() === "ADMIN";

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
      employeeId: emp.id,
      name,
      type: type || "OTHER",
      url,
      notes: notes || null,
      // Admin uploads are auto-approved; employee uploads need approval
      status: isAdmin ? "APPROVED" : "PENDING",
      uploadedBy: isAdmin ? "ADMIN" : "EMPLOYEE",
    },
  });

  // Notify admins when employee uploads
  if (!isAdmin) {
    try {
      const admins = await prisma.user.findMany({ where: { role: "ADMIN", isActive: true } });
      await Promise.all(admins.map(admin =>
        prisma.notification.create({
          data: {
            userId: admin.id,
            type: "SYSTEM",
            title: `📄 Document Uploaded — ${emp!.name}`,
            message: `${emp!.name} uploaded "${name}" (${(type || "OTHER").replace(/_/g, " ")}) — needs approval`,
          },
        })
      ));
    } catch { /* non-critical */ }
  }

  return NextResponse.json(doc, { status: 201 });
}

// PATCH — admin approves or rejects a document
export async function PATCH(req: NextRequest) {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clerkUser = await clerkClient.users.getUser(userId);
  const isAdmin = (clerkUser.publicMetadata?.role as string)?.toUpperCase() === "ADMIN";
  if (!isAdmin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const { id, status, adminNote } = await req.json();
  if (!id || !["APPROVED", "REJECTED"].includes(status))
    return NextResponse.json({ error: "id and valid status required" }, { status: 400 });

  const doc = await prisma.employeeDocument.update({
    where: { id },
    data: { status, adminNote: adminNote || null },
  });

  // Notify employee
  try {
    const emp = await prisma.employeeProfile.findUnique({ where: { id: doc.employeeId } });
    if (emp) {
      const empUser = await prisma.user.findFirst({ where: { email: emp.email } });
      if (empUser) {
        await prisma.notification.create({
          data: {
            userId: empUser.id,
            type: "SYSTEM",
            title: status === "APPROVED" ? `✅ Document Approved — ${doc.name}` : `❌ Document Rejected — ${doc.name}`,
            message: adminNote || (status === "APPROVED" ? "Your document has been approved." : "Your document was rejected."),
          },
        });
      }
    }
  } catch { /* non-critical */ }

  return NextResponse.json(doc);
}

// DELETE
export async function DELETE(req: NextRequest) {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await prisma.employeeDocument.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

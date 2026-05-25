import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { sendAdminEmail, leaveRequestEmailHtml } from "@/lib/email";

async function getEmployeeProfile(email: string) {
  return prisma.employeeProfile.findUnique({ where: { email } });
}

async function isAdmin(userId: string) {
  const u = await clerkClient.users.getUser(userId);
  return (u.publicMetadata?.role as string)?.toUpperCase() === "ADMIN";
}

// GET â€” admin: all leaves | employee: own leaves
export async function GET(req: NextRequest) {
  const { userId } = auth();
  if (!userId) return NextResponse.json([]);

  // Read role from DB first (no Clerk API call)
  const dbUser = await prisma.user.findUnique({ where: { clerkId: userId }, select: { role: true, email: true } });
  const role  = (dbUser?.role as string)?.toUpperCase();
  const admin = role === "ADMIN";

  if (admin) {
    const leaves = await prisma.leaveRequest.findMany({
      include: { employee: { select: { id: true, name: true, email: true, position: true, avatarUrl: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(leaves);
  }

  // Employee: own leaves
  const emailParam = new URL(req.url).searchParams.get("email");
  const empEmail = dbUser?.email || emailParam || "";
  const emp = empEmail ? await getEmployeeProfile(empEmail) : null;
  if (!emp) return NextResponse.json([]);

  const leaves = await prisma.leaveRequest.findMany({
    where: { employeeId: emp.id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(leaves);
}

// POST â€” employee applies for leave
export async function POST(req: NextRequest) {
  const { userId } = auth();
  const body = await req.json();
  const { type, fromDate, toDate, reason, employeeEmail } = body;

  if (!fromDate || !toDate || !reason)
    return NextResponse.json({ error: "fromDate, toDate, reason required" }, { status: 400 });

  let emp;
  if (userId) {
    const clerkUser = await clerkClient.users.getUser(userId).catch(() => null);
    const email = clerkUser?.emailAddresses[0]?.emailAddress;
    if (email) emp = await getEmployeeProfile(email);
    // If no employeeProfile, auto-create a basic one from User table
    if (!emp && email) {
      const dbUser = await prisma.user.findFirst({ where: { email } });
      if (dbUser) {
        emp = await prisma.employeeProfile.upsert({
          where: { email },
          update: {},
          create: { name: dbUser.name || email.split("@")[0], email, position: dbUser.role || "BROKER", role: dbUser.role || "BROKER", dob: new Date("2000-01-01") },
        });
      }
    }
  }
  // Fallback: identify by email sent from frontend
  if (!emp && employeeEmail) {
    emp = await getEmployeeProfile(employeeEmail);
    if (!emp) {
      const dbUser = await prisma.user.findFirst({ where: { email: employeeEmail } });
      if (dbUser) {
        emp = await prisma.employeeProfile.upsert({
          where: { email: employeeEmail },
          update: {},
          create: { name: dbUser.name || employeeEmail.split("@")[0], email: employeeEmail, position: dbUser.role || "BROKER", role: dbUser.role || "BROKER", dob: new Date("2000-01-01") },
        });
      }
    }
  }
  if (!emp) return NextResponse.json({ error: "Employee not found. Contact admin." }, { status: 404 });

  const from = new Date(fromDate);
  const to = new Date(toDate);
  const days = type === "HALF_DAY" ? 0.5 : Math.max(1, Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1);

  const leave = await prisma.leaveRequest.create({
    data: { employeeId: emp.id, type: type || "CASUAL", fromDate: from, toDate: to, days, reason },
  });

  // Notify all admins
  try {
    const admins = await prisma.user.findMany({ where: { role: "ADMIN" } });
    await Promise.all(admins.map(admin =>
      prisma.notification.create({
        data: {
          userId:  admin.id,
          type:    "LEAVE_REQUEST",
          title:   `Leave Request â€” ${emp.name}`,
          message: `${emp.name} applied for ${(type || "CASUAL").replace("_"," ")} leave from ${from.toLocaleDateString("en-IN")} to ${to.toLocaleDateString("en-IN")} (${days} day${days !== 1 ? "s" : ""}). Reason: ${reason}`,
        },
      })
    ));
  } catch { /* notifications are non-critical */ }

  sendAdminEmail(
    `🗓️ Leave Request: ${emp.name} (${(type || "CASUAL").replace("_", " ")})`,
    leaveRequestEmailHtml({
      employeeName: emp.name,
      type:         type || "CASUAL",
      fromDate:     from.toLocaleDateString("en-IN"),
      toDate:       to.toLocaleDateString("en-IN"),
      days,
      reason,
    })
  ).catch(() => {});

  return NextResponse.json(leave, { status: 201 });
}

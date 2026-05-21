import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs";
import { prisma } from "@/lib/prisma";

async function isAdmin(userId: string) {
  const u = await clerkClient.users.getUser(userId);
  return (u.publicMetadata?.role as string)?.toUpperCase() === "ADMIN";
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { userId } = auth();
  if (!userId || !(await isAdmin(userId)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const emp = await prisma.employeeProfile.findUnique({ where: { id: params.id } });
  if (!emp) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const dbUser = await prisma.user.findUnique({
    where: { email: emp.email },
    select: { id: true },
  });

  const [leaves, attendance, leads, deals, visits, activities] = await Promise.all([
    prisma.leaveRequest.findMany({
      where: { employeeId: emp.id },
      orderBy: { createdAt: "desc" },
    }),

    prisma.guestAttendance.findMany({
      where: { phone: emp.email },
      include: { location: { select: { name: true } } },
      orderBy: { punchIn: "desc" },
      take: 60,
    }),

    dbUser ? prisma.lead.findMany({
      where: { assignedToId: dbUser.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true, name: true, phone: true, status: true,
        score: true, source: true, budget: true, createdAt: true,
      },
    }) : [],

    dbUser ? prisma.deal.findMany({
      where: { brokerId: dbUser.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true, title: true, stage: true, value: true,
        createdAt: true, closedAt: true,
        lead: { select: { name: true } },
      },
    }) : [],

    dbUser ? prisma.siteVisit.findMany({
      where: { brokerId: dbUser.id },
      orderBy: { scheduledAt: "desc" },
      take: 20,
      select: {
        id: true, scheduledAt: true, status: true,
        lead: { select: { name: true } },
        property: { select: { title: true, locality: true } },
      },
    }) : [],

    dbUser ? prisma.activity.findMany({
      where: { userId: dbUser.id },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, type: true, description: true, createdAt: true },
    }) : [],
  ]);

  const totalHours = (attendance as any[]).reduce((s, a) => s + (a.workHours || 0), 0);
  const thisMonth  = new Date(); thisMonth.setDate(1); thisMonth.setHours(0, 0, 0, 0);

  return NextResponse.json({
    employee: emp,
    stats: {
      totalAttendance:     attendance.length,
      attendanceThisMonth: (attendance as any[]).filter(a => new Date(a.punchIn) >= thisMonth).length,
      totalHours:          Math.round(totalHours * 10) / 10,
      totalLeads:          leads.length,
      totalDeals:          deals.length,
      closedDeals:         (deals as any[]).filter(d => d.stage === "CLOSED").length,
      totalVisits:         visits.length,
      pendingLeaves:       (leaves as any[]).filter(l => l.status === "PENDING").length,
      approvedLeaves:      (leaves as any[]).filter(l => l.status === "APPROVED").length,
    },
    leaves,
    attendance,
    leads,
    deals,
    visits,
    activities,
  });
}

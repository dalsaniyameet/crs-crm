import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { checkOverdueFollowUps } from "@/lib/leadAutomation";

export const revalidate = 60;

async function getUser(clerkId: string) {
  return prisma.user.findUnique({ where: { clerkId } });
}

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await getUser(userId);
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const isBroker = user.role === "BROKER" || user.role === "SALES_MANAGER";
    const isAdmin   = user.role === "ADMIN" || user.role === "MARKETING";

    checkOverdueFollowUps().catch(() => {});

    // IST = UTC+5:30
    const nowIST = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
    const y = nowIST.getUTCFullYear(), m = nowIST.getUTCMonth(), d = nowIST.getUTCDate();
    const todayStart = new Date(Date.UTC(y, m, d, 0, 0, 0) - 5.5 * 60 * 60 * 1000);
    const todayEnd   = new Date(Date.UTC(y, m, d, 23, 59, 59) - 5.5 * 60 * 60 * 1000);

    // Strict: broker/sales_manager sirf apne assigned leads
    const leadWhere = isBroker ? { assignedToId: user.id } : {};

    const [
      totalLeads, hotLeads, dealsClosedCount,
      totalRevenue, activeProperties, leadsBySource,
      recentLeads, todayVisits, todayFollowUps,
    ] = await Promise.all([
      prisma.lead.count({ where: leadWhere }),
      prisma.lead.count({ where: { ...leadWhere, score: { gte: 80 } } }),
      isBroker
        ? prisma.deal.count({ where: { stage: "CLOSED", brokerId: user.id } })
        : prisma.deal.count({ where: { stage: "CLOSED" } }),
      isBroker
        ? prisma.deal.aggregate({ where: { stage: "CLOSED", brokerId: user.id }, _sum: { value: true } })
        : prisma.deal.aggregate({ where: { stage: "CLOSED" }, _sum: { value: true } }),
      prisma.property.count({ where: { status: "AVAILABLE" } }),
      // Broker doesn't see source breakdown
      isBroker
        ? Promise.resolve([])
        : prisma.lead.groupBy({ by: ["source"], _count: { id: true } }),
      prisma.lead.findMany({
        where: { ...leadWhere, score: { gte: 60 } },
        orderBy: [{ score: "desc" }, { createdAt: "desc" }],
        take: 6,
        select: { id: true, name: true, score: true, budget: true, source: true, requirements: true },
      }),
      prisma.siteVisit.findMany({
        where: {
          scheduledAt: { gte: todayStart, lte: todayEnd },
          ...(isBroker ? { brokerId: user.id } : {}),
        },
        take: 8,
        orderBy: { scheduledAt: "asc" },
        select: {
          id: true, scheduledAt: true, status: true,
          lead:     { select: { name: true } },
          property: { select: { title: true } },
          broker:   { select: { name: true } },
        },
      }),
      prisma.task.findMany({
        where: {
          dueAt: { gte: todayStart, lte: todayEnd },
          isCompleted: false,
          ...(isBroker ? { lead: { assignedToId: user.id } } : {}),
        },
        take: 10,
        orderBy: { dueAt: "asc" },
        select: {
          id: true, title: true, dueAt: true, priority: true,
          lead: { select: { id: true, name: true, phone: true } },
        },
      }),
    ]);

    // Broker performance — only for admin/manager
    let brokerPerformance: any[] = [];
    if (!isBroker) {
      const brokers = await prisma.user.findMany({
        where: { role: "BROKER", isActive: true },
        select: { id: true, name: true },
        take: 5,
      });
      brokerPerformance = await Promise.all(
        brokers.map(async (b) => {
          const [leads, deals, commissions] = await Promise.all([
            prisma.lead.count({ where: { assignedToId: b.id } }),
            prisma.deal.count({ where: { brokerId: b.id } }),
            prisma.commission.aggregate({ where: { brokerId: b.id }, _sum: { amount: true } }),
          ]);
          return { name: b.name, leads, deals, commission: commissions._sum.amount ?? 0 };
        })
      );
    }

    return NextResponse.json({
      isBroker,
      overview: {
        totalLeads,
        hotLeads,
        dealsClosedCount,
        totalRevenue: (totalRevenue as any)._sum?.value ?? 0,
        activeProperties,
      },
      leadsBySource,
      brokerPerformance,
      recentLeads,
      todayVisits,
      todayFollowUps,
    }, {
      headers: { "Cache-Control": "private, max-age=60" },
    });
  } catch (err: unknown) {
    console.error("Dashboard API Error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

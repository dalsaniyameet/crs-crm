import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkOverdueFollowUps } from "@/lib/leadAutomation";

export const revalidate = 60; // cache 60s

export async function GET() {
  try {
    checkOverdueFollowUps().catch(() => {});

    // IST = UTC+5:30
    const nowIST = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
    const y = nowIST.getUTCFullYear(), m = nowIST.getUTCMonth(), d = nowIST.getUTCDate();
    // Today start/end in UTC (IST midnight = UTC 18:30 prev day)
    const todayStart = new Date(Date.UTC(y, m, d, 0, 0, 0) - 5.5 * 60 * 60 * 1000);
    const todayEnd   = new Date(Date.UTC(y, m, d, 23, 59, 59) - 5.5 * 60 * 60 * 1000);

    const [
      totalLeads, hotLeads, dealsClosedCount,
      totalRevenue, activeProperties, leadsBySource, brokers,
      recentLeads, todayVisits, todayFollowUps,
    ] = await Promise.all([
      prisma.lead.count(),
      prisma.lead.count({ where: { score: { gte: 80 } } }),
      prisma.deal.count({ where: { stage: "CLOSED" } }),
      prisma.deal.aggregate({ where: { stage: "CLOSED" }, _sum: { value: true } }),
      prisma.property.count({ where: { status: "AVAILABLE" } }),
      prisma.lead.groupBy({ by: ["source"], _count: { id: true } }),
      prisma.user.findMany({
        where: { role: "BROKER", isActive: true },
        select: { id: true, name: true },
        take: 5,
      }),
      prisma.lead.findMany({
        orderBy: [{ score: "desc" }, { createdAt: "desc" }],
        take: 6,
        select: { id: true, name: true, score: true, budget: true, source: true, requirements: true },
      }),
      prisma.siteVisit.findMany({
        where: { scheduledAt: { gte: todayStart, lte: todayEnd } },
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
        where: { dueAt: { gte: todayStart, lte: todayEnd }, isCompleted: false },
        take: 10,
        orderBy: { dueAt: "asc" },
        select: {
          id: true, title: true, dueAt: true, priority: true,
          lead: { select: { id: true, name: true, phone: true } },
        },
      }),
    ]);

    const brokerPerformance = await Promise.all(
      brokers.map(async (b) => {
        const [leads, deals, commissions] = await Promise.all([
          prisma.lead.count({ where: { assignedToId: b.id } }),
          prisma.deal.count({ where: { brokerId: b.id } }),
          prisma.commission.aggregate({ where: { brokerId: b.id }, _sum: { amount: true } }),
        ]);
        return { name: b.name, leads, deals, commission: commissions._sum.amount ?? 0 };
      })
    );

    return NextResponse.json({
      overview: {
        totalLeads,
        hotLeads,
        dealsClosedCount,
        totalRevenue: totalRevenue._sum.value ?? 0,
        activeProperties,
      },
      leadsBySource,
      brokerPerformance,
      recentLeads,
      todayVisits,
      todayFollowUps,
    }, {
      headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=30" },
    });
  } catch (err: unknown) {
    console.error("Dashboard API Error:", err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? String(err) : undefined 
    }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkOverdueFollowUps } from "@/lib/leadAutomation";

export const revalidate = 60; // cache 60s

export async function GET() {
  try {
    // Check overdue follow-ups in background on every dashboard load
    checkOverdueFollowUps().catch(() => {});

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

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
        where: { score: { gte: 70 } },
        orderBy: { score: "desc" },
        take: 4,
        select: { id: true, name: true, score: true, budget: true, source: true, requirements: true },
      }),
      prisma.siteVisit.findMany({
        where: { scheduledAt: { gte: today, lt: tomorrow } },
        take: 8,
        select: {
          id: true, scheduledAt: true, status: true,
          lead:     { select: { name: true } },
          property: { select: { title: true } },
          broker:   { select: { name: true } },
        },
      }),
      prisma.task.findMany({
        where: { dueAt: { gte: today, lt: tomorrow }, isCompleted: false },
        take: 8,
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
          prisma.commission.aggregate({ where: { brokerId: b.id, isPaid: true }, _sum: { amount: true } }),
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

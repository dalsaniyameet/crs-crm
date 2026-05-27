import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const period    = searchParams.get("period") ?? "month";
    const now       = new Date();
    const startDate = new Date();

    if      (period === "week")    startDate.setDate(now.getDate() - 7);
    else if (period === "month")   startDate.setMonth(now.getMonth() - 1);
    else if (period === "quarter") startDate.setMonth(now.getMonth() - 3);
    else if (period === "year")    startDate.setFullYear(now.getFullYear() - 1);

    const [
      totalLeads, newLeads, hotLeads, dealsClosedCount,
      totalRevenue, totalCommission, siteVisitsCount,
      leadsBySource, dealsByStage, brokers,
    ] = await Promise.all([
      prisma.lead.count(),
      prisma.lead.count({ where: { createdAt: { gte: startDate } } }),
      prisma.lead.count({ where: { score: { gte: 80 } } }),
      prisma.deal.count({ where: { stage: "CLOSED" } }),
      prisma.deal.aggregate({ where: { stage: "CLOSED" }, _sum: { value: true } }),
      prisma.commission.aggregate({ where: { isPaid: true }, _sum: { amount: true } }),
      prisma.siteVisit.count({ where: { scheduledAt: { gte: startDate } } }),
      prisma.lead.groupBy({ by: ["source"], _count: { id: true } }),
      prisma.deal.groupBy({ by: ["stage"],  _count: { id: true } }),
      prisma.user.findMany({
        where:   { role: "BROKER", isActive: true },
        select:  { id: true, name: true },
      }),
    ]);

    // Broker performance — separate queries to avoid relation name issues
    const brokerPerformance = await Promise.all(
      brokers.map(async (b) => {
        const [leads, deals, commissions] = await Promise.all([
          prisma.lead.count({ where: { assignedToId: b.id } }),
          prisma.deal.count({ where: { brokerId: b.id } }),
          prisma.commission.aggregate({ where: { brokerId: b.id, isPaid: true }, _sum: { amount: true } }),
        ]);
        return { id: b.id, name: b.name, leads, deals, commission: commissions._sum.amount ?? 0 };
      })
    );

    return NextResponse.json({
      overview: {
        totalLeads, newLeads, hotLeads, dealsClosedCount,
        totalRevenue:    totalRevenue._sum.value    ?? 0,
        totalCommission: totalCommission._sum.amount ?? 0,
        siteVisitsCount,
      },
      leadsBySource,
      dealsByStage,
      brokerPerformance,
    });
  } catch (err: any) {
    console.error("Reports GET error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const isBroker = user.role === "BROKER";

    const { searchParams } = new URL(req.url);
    const period    = searchParams.get("period") ?? "month";
    const now       = new Date();
    const startDate = new Date();

    if      (period === "week")    startDate.setDate(now.getDate() - 7);
    else if (period === "month")   startDate.setMonth(now.getMonth() - 1);
    else if (period === "quarter") startDate.setMonth(now.getMonth() - 3);
    else if (period === "year")    startDate.setFullYear(now.getFullYear() - 1);

    // Broker sirf apna data dekhe
    const leadWhere  = isBroker ? { assignedToId: user.id } : {};
    const dealWhere  = isBroker ? { brokerId: user.id }     : {};
    const visitWhere = isBroker ? { brokerId: user.id }     : {};

    const [
      totalLeads, newLeads, hotLeads, dealsClosedCount,
      totalRevenue, totalCommission, siteVisitsCount,
      leadsBySource, dealsByStage, brokers,
    ] = await Promise.all([
      prisma.lead.count({ where: leadWhere }),
      prisma.lead.count({ where: { ...leadWhere, createdAt: { gte: startDate } } }),
      prisma.lead.count({ where: { ...leadWhere, score: { gte: 80 } } }),
      prisma.deal.count({ where: { ...dealWhere, stage: "CLOSED" } }),
      prisma.deal.aggregate({ where: { ...dealWhere, stage: "CLOSED" }, _sum: { value: true } }),
      prisma.commission.aggregate({ where: { ...dealWhere, isPaid: true }, _sum: { amount: true } }),
      prisma.siteVisit.count({ where: { ...visitWhere, scheduledAt: { gte: startDate } } }),
      // Broker ko source breakdown nahi dikhta
      isBroker ? Promise.resolve([]) : prisma.lead.groupBy({ by: ["source"], _count: { id: true } }),
      isBroker ? Promise.resolve([]) : prisma.deal.groupBy({ by: ["stage"],  _count: { id: true } }),
      isBroker ? Promise.resolve([]) : prisma.user.findMany({
        where:  { role: "BROKER", isActive: true },
        select: { id: true, name: true },
      }),
    ]);

    // Broker performance — only for admin
    const brokerPerformance = isBroker ? [] : await Promise.all(
      (brokers as any[]).map(async (b) => {
        const [leads, deals, commissions] = await Promise.all([
          prisma.lead.count({ where: { assignedToId: b.id } }),
          prisma.deal.count({ where: { brokerId: b.id } }),
          prisma.commission.aggregate({ where: { brokerId: b.id, isPaid: true }, _sum: { amount: true } }),
        ]);
        return { id: b.id, name: b.name, leads, deals, commission: commissions._sum.amount ?? 0 };
      })
    );

    return NextResponse.json({
      isBroker,
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

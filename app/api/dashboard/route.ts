import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { checkOverdueFollowUps, checkUncontactedLeads } from "@/lib/leadAutomation";

export const dynamic = "force-dynamic";

async function getUser(clerkId: string) {
  return prisma.user.findUnique({ where: { clerkId } });
}

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let user = await getUser(userId);

    // Always check ADMIN_EMAILS first — most reliable
    const adminEmailsList = (process.env.ADMIN_EMAILS || "").split(",").map(e => e.trim().toLowerCase()).filter(Boolean);

    // If user not in DB, auto-create from Clerk
    if (!user) {
      try {
        const { clerkClient } = await import("@clerk/nextjs/server");
        const clerk = await clerkClient();
        const clerkUser = await clerk.users.getUser(userId);
        const email = clerkUser.emailAddresses?.[0]?.emailAddress || "";
        const name  = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || "User";
        const metaRole = (clerkUser.publicMetadata?.role as string) || "";
        const role = adminEmailsList.includes(email.toLowerCase()) ? "ADMIN"
          : metaRole ? metaRole : "BROKER";
        user = await prisma.user.upsert({
          where: { clerkId: userId },
          update: { email, name, role },
          create: { clerkId: userId, email, name, role, avatar: clerkUser.imageUrl },
        });
        console.log("[Dashboard] Auto-created user:", email, "role:", role);
      } catch (e) {
        console.error("[Dashboard] Failed to create user:", e);
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
    }

    // Fix role if email is in ADMIN_EMAILS but DB has wrong role
    if (adminEmailsList.includes((user.email || "").toLowerCase()) && user.role !== "ADMIN") {
      await prisma.user.update({ where: { id: user.id }, data: { role: "ADMIN" } }).catch(() => {});
      user = { ...user, role: "ADMIN" };
      console.log("[Dashboard] Fixed role to ADMIN for:", user.email);
    }

    const isAdmin  = user.role === "ADMIN" || user.role === "SALES_MANAGER" || adminEmailsList.includes((user.email || "").toLowerCase());
    const isBroker = !isAdmin;
    console.log("[Dashboard] email:", user.email, "role:", user.role, "isAdmin:", isAdmin);

    checkOverdueFollowUps().catch(() => {});
    checkUncontactedLeads().catch(() => {});

    // IST = UTC+5:30
    const nowIST = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
    const y = nowIST.getUTCFullYear(), m = nowIST.getUTCMonth(), d = nowIST.getUTCDate();
    const todayStart = new Date(Date.UTC(y, m, d, 0, 0, 0) - 5.5 * 60 * 60 * 1000);
    const todayEnd   = new Date(Date.UTC(y, m, d, 23, 59, 59) - 5.5 * 60 * 60 * 1000);
    const nowUTC     = new Date();

    // Strict: broker/sales_manager sirf apne assigned leads
    const leadWhere = isBroker ? { assignedToId: user.id } : {};

    const [
      totalLeads, hotLeads, dealsClosedCount,
      totalRevenue, activeProperties, leadsBySource,
      recentLeads, todayVisits, todayFollowUps,
      overdueCount,
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
          ...(isBroker ? { assignedToId: user.id } : {}),
        },
        take: 10,
        orderBy: { dueAt: "asc" },
        select: {
          id: true, title: true, dueAt: true, priority: true,
          assignedTo: { select: { id: true, name: true } },
          lead: { select: { id: true, name: true, phone: true } },
        },
      }),
      prisma.task.count({
        where: { dueAt: { lt: nowUTC }, isCompleted: false, ...(isBroker ? { assignedToId: user.id } : {}) },
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

    // Lead source conversion rates (admin only)
    let leadSourceStats: any[] = [];
    if (isAdmin) {
      const sources = await prisma.lead.groupBy({
        by: ["source", "status"],
        _count: { id: true },
      });
      const sourceMap: Record<string, { total: number; closed: number }> = {};
      sources.forEach(s => {
        if (!sourceMap[s.source]) sourceMap[s.source] = { total: 0, closed: 0 };
        sourceMap[s.source].total += s._count.id;
        if (s.status === "DEAL_CLOSED") sourceMap[s.source].closed += s._count.id;
      });
      leadSourceStats = Object.entries(sourceMap).map(([source, d]) => ({
        source,
        total: d.total,
        closed: d.closed,
        rate: d.total > 0 ? Math.round((d.closed / d.total) * 100) : 0,
      })).sort((a, b) => b.rate - a.rate);
    }

    // Employee performance scores (admin only)
    let employeeScores: any[] = [];
    if (isAdmin) {
      const allBrokers = await prisma.user.findMany({
        where: { role: "BROKER", isActive: true },
        select: { id: true, name: true },
      });
      const weekStart = new Date(nowUTC); weekStart.setDate(weekStart.getDate() - 7);
      employeeScores = await Promise.all(allBrokers.map(async b => {
        const [leads, deals, visits, calls, tasks] = await Promise.all([
          prisma.lead.count({ where: { assignedToId: b.id } }),
          prisma.deal.count({ where: { brokerId: b.id, stage: "CLOSED" } }),
          prisma.siteVisit.count({ where: { brokerId: b.id, status: "COMPLETED" } }),
          prisma.callLog.count({ where: { userId: b.id, createdAt: { gte: weekStart } } }),
          prisma.task.count({ where: { assignedToId: b.id, isCompleted: true, updatedAt: { gte: weekStart } } }),
        ]);
        const score = Math.min(100, Math.round(
          (leads * 2) + (deals * 20) + (visits * 5) + (calls * 1) + (tasks * 3)
        ));
        return { id: b.id, name: b.name, leads, deals, visits, calls, tasks, score };
      }));
      employeeScores.sort((a, b) => b.score - a.score);
    }

    return NextResponse.json({
      isBroker,
      userRole: user.role,
      overdueCount,
      leadSourceStats,
      employeeScores,
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
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err: unknown) {
    console.error("Dashboard API Error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import type { Role } from "@prisma/client";
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
    let clerkEmail = "";
    let clerkRole = "";

    try {
      const { clerkClient } = await import("@clerk/nextjs/server");
      const clerk = await clerkClient();
      const clerkUser = await clerk.users.getUser(userId);
      clerkEmail = clerkUser.emailAddresses?.[0]?.emailAddress || "";
      clerkRole = (clerkUser.publicMetadata?.role as string) || "";

      const effectiveRole: Role = adminEmailsList.includes(clerkEmail.toLowerCase())
        ? "ADMIN"
        : (clerkRole || user?.role || "BROKER") as Role;

      if (!user) {
        const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || "User";
        user = await prisma.user.upsert({
          where: { clerkId: userId },
          update: { email: clerkEmail, name, role: effectiveRole as any },
          create: { clerkId: userId, email: clerkEmail, name, role: effectiveRole as any, avatar: clerkUser.imageUrl },
        } as any);
        console.log("[Dashboard] Auto-created user:", clerkEmail, "role:", effectiveRole);
      } else {
        const nextName = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || user.name;
        if (user.email !== clerkEmail || user.role !== effectiveRole || user.name !== nextName) {
          user = await prisma.user.update({
            where: { id: user.id },
            data: { email: clerkEmail || user.email, name: nextName, role: effectiveRole as any, avatar: clerkUser.imageUrl || user.avatar },
          } as any);
        }
      }

      if (adminEmailsList.includes((user.email || clerkEmail || "").toLowerCase()) && user.role !== "ADMIN") {
        user = await prisma.user.update({ where: { id: user.id }, data: { role: "ADMIN" as any } } as any);
        console.log("[Dashboard] Fixed role to ADMIN for:", user.email || clerkEmail);
      }
    } catch (e) {
      console.error("[Dashboard] Failed to load Clerk user:", e);
      if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
    }

    const effectiveRole: Role = user.role;
    const isAdmin  = effectiveRole === "ADMIN" || effectiveRole === "SALES_MANAGER" || adminEmailsList.includes((user.email || clerkEmail || "").toLowerCase());
    const isBroker = !isAdmin;
    console.log("[Dashboard] email:", user.email || clerkEmail, "role:", effectiveRole, "isAdmin:", isAdmin);

    // Run background automations — non-blocking, never crash dashboard
    try { checkOverdueFollowUps(); } catch {}
    try { checkUncontactedLeads(); } catch {}

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
      userRole: effectiveRole,
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

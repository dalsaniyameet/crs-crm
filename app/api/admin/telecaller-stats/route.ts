import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user || user.role === "BROKER")
      return NextResponse.json({ error: "Access denied" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date"); // YYYY-MM-DD, default today

    // IST date range
    const d = date ? new Date(date) : new Date(Date.now() + 5.5 * 60 * 60 * 1000);
    const y = d.getUTCFullYear(), m = d.getUTCMonth(), day = d.getUTCDate();
    const start = new Date(Date.UTC(y, m, day, 0, 0, 0) - 5.5 * 60 * 60 * 1000);
    const end   = new Date(Date.UTC(y, m, day, 23, 59, 59) - 5.5 * 60 * 60 * 1000);

    // All users (brokers/telecallers)
    const users = await prisma.user.findMany({
      where: { isActive: true, role: { in: ["BROKER", "SALES_MANAGER", "MARKETING"] } },
      select: { id: true, name: true, role: true, avatar: true },
    });

    // All call logs for the day with lead info
    const callLogs = await prisma.callLog.findMany({
      where: { createdAt: { gte: start, lte: end } },
      include: {
        lead: { select: { id: true, name: true, phone: true, score: true, status: true } },
        user: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Daily reports for the day (employee self-reported)
    const dailyReports = await prisma.dailyReport.findMany({
      where: { date: { gte: start, lte: end } },
      include: { employee: { select: { id: true, name: true, email: true } } },
    });

    // Per-user stats from real CallLog data
    const stats = users.map(u => {
      const userLogs = callLogs.filter(c => c.userId === u.id);
      const total       = userLogs.length;
      const connected   = userLogs.filter(c => c.outcome === "ANSWERED" || c.outcome === "INTERESTED").length;
      const noAnswer    = userLogs.filter(c => c.outcome === "NO_ANSWER").length;
      const busy        = userLogs.filter(c => c.outcome === "BUSY").length;
      const callback    = userLogs.filter(c => c.outcome === "CALLBACK_REQUESTED").length;
      const interested  = userLogs.filter(c => c.outcome === "INTERESTED").length;
      const notInterested = userLogs.filter(c => c.outcome === "NOT_INTERESTED").length;
      const totalDuration = userLogs.reduce((s, c) => s + (c.duration || 0), 0);
      const avgDuration   = total > 0 ? Math.round(totalDuration / total) : 0;
      const connectRate   = total > 0 ? Math.round((connected / total) * 100) : 0;

      // Hot leads contacted today (score >= 80)
      const hotLeadsContacted = userLogs.filter(c => (c.lead?.score ?? 0) >= 80).length;

      // Match with daily report if exists (by email match — employee profile linked by email)
      const report = dailyReports.find(r =>
        r.employee?.email && users.find(u2 => u2.id === u.id)
      ) || null;

      return {
        userId: u.id,
        name: u.name,
        role: u.role,
        avatar: u.avatar,
        // Real call log stats
        totalCalls: total,
        connected,
        noAnswer,
        busy,
        callback,
        interested,
        notInterested,
        totalDuration,
        avgDuration,
        connectRate,
        hotLeadsContacted,
        // Call details list
        calls: userLogs.map(c => ({
          id: c.id,
          leadName:  c.lead?.name  || "—",
          leadPhone: c.lead?.phone || "—",
          leadScore: c.lead?.score ?? 0,
          leadStatus: c.lead?.status || "—",
          outcome:   c.outcome || "—",
          duration:  c.duration || 0,
          notes:     c.notes || "",
          createdAt: c.createdAt,
        })),
        // Self-reported daily report data
        dailyReport: report ? {
          newLeads:       report.newLeads,
          siteVisits:     report.siteVisits,
          dealsClosed:    report.dealsClosed,
          dealValue:      report.dealValue,
          followUpsDone:  report.followUpsDone,
          followUpsPending: report.followUpsPending,
          highlights:     report.highlights,
          challenges:     report.challenges,
          tomorrowPlan:   report.tomorrowPlan,
          status:         report.status,
          adminNote:      report.adminNote,
          // Self-reported call entries from daily report
          reportedCalls:  report.totalCalls,
          reportedConnected: report.connectedCalls,
          callEntries:    report.callEntries,
        } : null,
      };
    });

    // Only return users who made calls OR submitted daily report
    const activeStats = stats.filter(s => s.totalCalls > 0 || s.dailyReport);

    // Team totals
    const teamTotals = {
      totalCalls:   callLogs.length,
      connected:    callLogs.filter(c => c.outcome === "ANSWERED" || c.outcome === "INTERESTED").length,
      interested:   callLogs.filter(c => c.outcome === "INTERESTED").length,
      totalDuration: callLogs.reduce((s, c) => s + (c.duration || 0), 0),
      reportsSubmitted: dailyReports.length,
      activeCallers: activeStats.length,
    };

    return NextResponse.json({ date: start.toISOString(), teamTotals, stats: activeStats, allStats: stats });
  } catch (err: any) {
    console.error("Telecaller stats error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

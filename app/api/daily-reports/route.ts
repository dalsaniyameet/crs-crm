import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyDailyReport } from "@/lib/notify";

// GET — fetch reports (admin: all, employee: own)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get("employeeId");
    const date       = searchParams.get("date"); // YYYY-MM-DD
    const limit      = parseInt(searchParams.get("limit") || "30");

    const where: any = {};
    if (employeeId) where.employeeId = employeeId;
    if (date) {
      const d = new Date(date);
      const next = new Date(d); next.setDate(next.getDate() + 1);
      where.date = { gte: d, lt: next };
    }

    const reports = await prisma.dailyReport.findMany({
      where,
      include: { employee: { select: { id: true, name: true, position: true, avatarUrl: true, role: true } } },
      orderBy: { date: "desc" },
      take: limit,
    });

    return NextResponse.json(reports);
  } catch (err: any) {
    console.error("Daily reports GET error:", err?.message);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

// POST — submit/update daily report
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      employeeId, date,
      totalCalls, connectedCalls, newLeads,
      siteVisits, visitsFeedback,
      dealsInProgress, dealsClosed, dealValue,
      propertiesListed, propertiesVisited,
      followUpsDone, followUpsPending,
      highlights, challenges, tomorrowPlan,
      callEntries,
      excelFileUrl, excelFileName,
    } = body;

    if (!employeeId || !date) return NextResponse.json({ error: "employeeId and date required" }, { status: 400 });

    const reportDate = new Date(date);
    reportDate.setHours(0, 0, 0, 0);

    const report = await prisma.dailyReport.upsert({
      where: { employeeId_date: { employeeId, date: reportDate } },
      update: {
        totalCalls: totalCalls || 0, connectedCalls: connectedCalls || 0, newLeads: newLeads || 0,
        siteVisits: siteVisits || 0, visitsFeedback: visitsFeedback || null,
        dealsInProgress: dealsInProgress || 0, dealsClosed: dealsClosed || 0, dealValue: dealValue || 0,
        propertiesListed: propertiesListed || 0, propertiesVisited: propertiesVisited || 0,
        followUpsDone: followUpsDone || 0, followUpsPending: followUpsPending || 0,
        highlights: highlights || null, challenges: challenges || null, tomorrowPlan: tomorrowPlan || null,
        callEntries: callEntries || [],
        excelFileUrl: excelFileUrl || null,
        excelFileName: excelFileName || null,
        status: "SUBMITTED",
      },
      create: {
        employeeId, date: reportDate,
        totalCalls: totalCalls || 0, connectedCalls: connectedCalls || 0, newLeads: newLeads || 0,
        siteVisits: siteVisits || 0, visitsFeedback: visitsFeedback || null,
        dealsInProgress: dealsInProgress || 0, dealsClosed: dealsClosed || 0, dealValue: dealValue || 0,
        propertiesListed: propertiesListed || 0, propertiesVisited: propertiesVisited || 0,
        followUpsDone: followUpsDone || 0, followUpsPending: followUpsPending || 0,
        highlights: highlights || null, challenges: challenges || null, tomorrowPlan: tomorrowPlan || null,
        callEntries: callEntries || [],
        excelFileUrl: excelFileUrl || null,
        excelFileName: excelFileName || null,
        status: "SUBMITTED",
      },
      include: { employee: { select: { name: true } } },
    });

    notifyDailyReport({
      employeeName: report.employee?.name || "Employee",
      date:         new Date(reportDate).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }),
      totalCalls:   totalCalls || 0,
      connectedCalls: connectedCalls || 0,
      newLeads:     newLeads || 0,
      siteVisits:   siteVisits || 0,
      dealsClosed:  dealsClosed || 0,
      dealValue:    dealValue || 0,
      highlights,
      challenges,
      tomorrowPlan,
    }).catch(() => {});

    return NextResponse.json(report);
  } catch (err: any) {
    console.error("Daily report POST error:", err?.message);
    return NextResponse.json({ error: err?.message || "Failed" }, { status: 500 });
  }
}

// PATCH — admin adds note / marks reviewed
export async function PATCH(req: NextRequest) {
  try {
    const { id, adminNote, status } = await req.json();
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const report = await prisma.dailyReport.update({
      where: { id },
      data: { adminNote: adminNote ?? undefined, status: status ?? undefined },
    });
    return NextResponse.json(report);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed" }, { status: 500 });
  }
}

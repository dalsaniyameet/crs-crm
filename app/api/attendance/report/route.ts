import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

// GET /api/attendance/report?month=2025-01&employeeId=xxx&export=csv
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await prisma.user.findUnique({ where: { clerkId: userId }, select: { role: true } });
  const isAdmin = dbUser?.role?.toUpperCase() === "ADMIN";

  const { searchParams } = req.nextUrl;
  const monthParam  = searchParams.get("month"); // e.g. "2025-01"
  const employeeId  = searchParams.get("employeeId");
  const exportCsv   = searchParams.get("export") === "csv";

  const now   = new Date();
  const year  = monthParam ? parseInt(monthParam.split("-")[0]) : now.getFullYear();
  const month = monthParam ? parseInt(monthParam.split("-")[1]) : now.getMonth() + 1;

  const from = new Date(year, month - 1, 1);
  const to   = new Date(year, month, 0, 23, 59, 59, 999); // last day of month

  // Get all employees (admin) or just the requesting employee
  let employees: { id: string; name: string; email: string; position: string }[] = [];
  if (isAdmin) {
    employees = await prisma.employeeProfile.findMany({
      where:   employeeId ? { id: employeeId } : { isActive: true },
      select:  { id: true, name: true, email: true, position: true },
      orderBy: { name: "asc" },
    });
  } else {
    // Employee sees own report only
    const clerkUser = await prisma.user.findUnique({ where: { clerkId: userId }, select: { email: true } });
    const emp = clerkUser?.email ? await prisma.employeeProfile.findUnique({ where: { email: clerkUser.email }, select: { id: true, name: true, email: true, position: true } }) : null;
    if (emp) employees = [emp];
  }

  if (!employees.length) return NextResponse.json([]);

  // Working days in the month (Mon–Sat, excluding Sundays)
  const workingDays = countWorkingDays(from, to);

  const reports = await Promise.all(employees.map(async (emp) => {
    // Attendance records for this month
    const records = await prisma.guestAttendance.findMany({
      where: {
        OR: [{ phone: emp.email }, { phone: emp.email.toLowerCase() }, { name: { contains: emp.name, mode: "insensitive" } }],
        punchIn: { gte: from, lte: to },
      },
      orderBy: { punchIn: "asc" },
    });

    // Approved leaves for this month
    const leaves = await prisma.leaveRequest.findMany({
      where: { employeeId: emp.id, status: "APPROVED", fromDate: { lte: to }, toDate: { gte: from } },
    });

    let presentDays  = 0;
    let halfDays     = 0;
    let lateDays     = 0;
    let totalHours   = 0;
    let overtimeH    = 0;
    let leaveDays    = 0;

    // Count approved leave days (within the month)
    for (const leave of leaves) {
      const leaveFrom = leave.fromDate < from ? from : leave.fromDate;
      const leaveTo   = leave.toDate   > to   ? to   : leave.toDate;
      leaveDays += leave.type === "HALF_DAY" ? 0.5 : countWorkingDays(leaveFrom, leaveTo);
    }

    // Dedupe records by day — keep latest per day
    const byDay = new Map<string, typeof records[0]>();
    for (const r of records) {
      const dayKey = r.punchIn.toISOString().split("T")[0];
      if (!byDay.has(dayKey) || r.punchIn > byDay.get(dayKey)!.punchIn) byDay.set(dayKey, r);
    }

    for (const r of byDay.values()) {
      if (r.punchOut) {
        if (r.isHalfDay) halfDays++;
        else presentDays++;
        if (r.lateMinutes > 0) lateDays++;
        totalHours  += r.workHours ?? 0;
        overtimeH   += r.overtimeHours ?? 0;
      }
    }

    // Leave vs Absent sync: days with no attendance and no leave = absent
    const leavedays_set = new Set<string>();
    for (const leave of leaves) {
      let d = new Date(leave.fromDate < from ? from : leave.fromDate);
      const end = leave.toDate > to ? to : leave.toDate;
      while (d <= end) {
        if (d.getDay() !== 0) leavedays_set.add(d.toISOString().split("T")[0]);
        d = new Date(d.getTime() + 86400000);
      }
    }
    const attendedDays = new Set(byDay.keys());
    let absentDays = 0;
    let d = new Date(from);
    while (d <= to && d <= now) {
      const dayStr = d.toISOString().split("T")[0];
      if (d.getDay() !== 0 && !attendedDays.has(dayStr) && !leavedays_set.has(dayStr)) absentDays++;
      d = new Date(d.getTime() + 86400000);
    }

    return {
      employeeId:   emp.id,
      employeeName: emp.name,
      position:     emp.position,
      month:        `${year}-${String(month).padStart(2, "0")}`,
      workingDays,
      presentDays,
      halfDays,
      absentDays,
      leaveDays,
      lateDays,
      totalHours:   parseFloat(totalHours.toFixed(2)),
      overtimeHours: parseFloat(overtimeH.toFixed(2)),
      records:      Array.from(byDay.values()),
    };
  }));

  if (exportCsv) {
    const rows = [
      ["Employee", "Position", "Month", "Working Days", "Present", "Half Days", "Absent", "Leave", "Late Days", "Total Hours", "Overtime Hours"],
      ...reports.map(r => [r.employeeName, r.position, r.month, r.workingDays, r.presentDays, r.halfDays, r.absentDays, r.leaveDays, r.lateDays, r.totalHours, r.overtimeHours]),
    ];
    const csv = rows.map(r => r.join(",")).join("\n");
    return new Response(csv, {
      headers: {
        "Content-Type":        "text/csv",
        "Content-Disposition": `attachment; filename="attendance-${year}-${month}.csv"`,
      },
    });
  }

  return NextResponse.json(reports);
}

function countWorkingDays(from: Date, to: Date): number {
  let count = 0;
  let d = new Date(from);
  while (d <= to) {
    if (d.getDay() !== 0) count++;
    d = new Date(d.getTime() + 86400000);
  }
  return count;
}

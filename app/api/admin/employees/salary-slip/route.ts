import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const clerk = await clerkClient();
    const u = await clerk.users.getUser(userId);
    const isAdmin = (u.publicMetadata?.role as string)?.toUpperCase() === "ADMIN";
    if (!isAdmin) {
      const dbUser = await prisma.user.findUnique({ where: { clerkId: userId }, select: { role: true } });
      if (dbUser?.role?.toUpperCase() !== "ADMIN")
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { employeeId, month, year, basicSalary, hra, conveyance, medical, bonus, deductions, notes } = await req.json();
    if (!employeeId || !month || !year)
      return NextResponse.json({ error: "employeeId, month, year required" }, { status: 400 });

    const emp = await prisma.employeeProfile.findUnique({ where: { id: employeeId } });
    if (!emp) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

    const from = new Date(year, month - 1, 1);
    const to   = new Date(year, month, 0, 23, 59, 59);

    const attendance = await prisma.guestAttendance.findMany({
      where: { phone: emp.email, punchIn: { gte: from, lte: to }, punchOut: { not: null } },
    });

    const workingDays = attendance.length;
    const totalHours  = attendance.reduce((s, a) => s + (a.workHours || 0), 0);
    const lateCount   = attendance.filter(a => a.lateMinutes > 0).length;
    const overtimeH   = attendance.reduce((s, a) => s + (a.overtimeHours || 0), 0);

    const basic       = Number(basicSalary) || 0;
    const hraAmt      = Number(hra)         || Math.round(basic * 0.4);
    const convAmt     = Number(conveyance)  || 1600;
    const medAmt      = Number(medical)     || 1250;
    const bonusAmt    = Number(bonus)       || 0;
    const deductAmt   = Number(deductions)  || 0;
    const grossSalary = basic + hraAmt + convAmt + medAmt + bonusAmt;
    const pf          = Math.round(basic * 0.12);
    const esi         = grossSalary <= 21000 ? Math.round(grossSalary * 0.0075) : 0;
    const totalDeduct = deductAmt + pf + esi;
    const netSalary   = grossSalary - totalDeduct;

    // Per-day salary for absent deduction
    const perDaySalary = basic / 26;
    const expectedDays = 26;
    const absentDays   = Math.max(0, expectedDays - workingDays);
    const absentDeduct = Math.round(perDaySalary * absentDays);

    const slip = {
      employee: {
        name: emp.name, email: emp.email,
        position: emp.position, role: emp.role,
        avatarUrl: emp.avatarUrl,
      },
      period: {
        month: MONTH_NAMES[month - 1], year,
        from: from.toLocaleDateString("en-IN"),
        to:   to.toLocaleDateString("en-IN"),
      },
      attendance: {
        workingDays, totalHours: Math.round(totalHours * 10) / 10,
        lateCount, overtimeHours: Math.round(overtimeH * 10) / 10,
        absentDays, expectedDays,
      },
      earnings: {
        basic, hra: hraAmt, conveyance: convAmt,
        medical: medAmt, bonus: bonusAmt, gross: grossSalary,
      },
      deductions: {
        pf, esi, absentDeduction: absentDeduct,
        other: deductAmt, total: totalDeduct + absentDeduct,
      },
      netSalary: netSalary - absentDeduct,
      notes: notes || "",
      generatedAt: new Date().toISOString(),
      company: {
        name: "City Real Space",
        address: "A-708, Prahlad Nagar Trade Centre, Satellite, Ahmedabad - 380015",
        gstin: "24XXXXX0000X1ZX",
      },
    };

    // Save to DB
    await prisma.salarySlip.upsert({
      where: { employeeId_month_year: { employeeId, month, year } },
      update: {
        basicSalary: basic, presentDays: workingDays, absentDays,
        overtimeHours: overtimeH, deductions: totalDeduct + absentDeduct,
        bonus: bonusAmt, netSalary: slip.netSalary,
        totalHours: Math.round(totalHours * 10) / 10, notes: notes || null,
      },
      create: {
        employeeId, month, year,
        basicSalary: basic, presentDays: workingDays, absentDays,
        halfDays: 0, overtimeHours: overtimeH,
        deductions: totalDeduct + absentDeduct,
        bonus: bonusAmt, netSalary: slip.netSalary,
        workingDays: expectedDays,
        totalHours: Math.round(totalHours * 10) / 10,
        notes: notes || null,
      },
    });

    return NextResponse.json(slip);
  } catch (err: any) {
    console.error("Salary slip error:", err?.message);
    return NextResponse.json({ error: err?.message || "Failed" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json([], { status: 401 });

    const empId = new URL(req.url).searchParams.get("employeeId");
    if (!empId) return NextResponse.json([]);

    const slips = await prisma.salarySlip.findMany({
      where: { employeeId: empId },
      orderBy: [{ year: "desc" }, { month: "desc" }],
    });
    return NextResponse.json(slips);
  } catch {
    return NextResponse.json([]);
  }
}

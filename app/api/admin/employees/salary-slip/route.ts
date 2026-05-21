import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs";
import { prisma } from "@/lib/prisma";

async function isAdmin(userId: string) {
  const u = await clerkClient.users.getUser(userId);
  return (u.publicMetadata?.role as string)?.toUpperCase() === "ADMIN";
}

export async function POST(req: NextRequest) {
  const { userId } = auth();
  if (!userId || !(await isAdmin(userId)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { employeeId, month, year, basicSalary, hra, conveyance, medical, bonus, deductions, notes } = await req.json();
  if (!employeeId || !month || !year)
    return NextResponse.json({ error: "employeeId, month, year required" }, { status: 400 });

  const emp = await prisma.employeeProfile.findUnique({ where: { id: employeeId } });
  if (!emp) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  // Fetch attendance for the month
  const from = new Date(year, month - 1, 1);
  const to   = new Date(year, month, 0, 23, 59, 59);
  const attendance = await prisma.guestAttendance.findMany({
    where: { phone: emp.email, punchIn: { gte: from, lte: to }, punchOut: { not: null } },
  });

  const workingDays   = attendance.length;
  const totalHours    = attendance.reduce((s, a) => s + (a.workHours || 0), 0);
  const basic         = Number(basicSalary)   || 0;
  const hraAmt        = Number(hra)           || 0;
  const convAmt       = Number(conveyance)    || 0;
  const medAmt        = Number(medical)       || 0;
  const bonusAmt      = Number(bonus)         || 0;
  const deductAmt     = Number(deductions)    || 0;
  const grossSalary   = basic + hraAmt + convAmt + medAmt + bonusAmt;
  const pf            = Math.round(basic * 0.12);
  const esi           = grossSalary <= 21000 ? Math.round(grossSalary * 0.0075) : 0;
  const totalDeduct   = deductAmt + pf + esi;
  const netSalary     = grossSalary - totalDeduct;

  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];

  const slip = {
    employee: { name: emp.name, email: emp.email, position: emp.position, role: emp.role, avatarUrl: emp.avatarUrl },
    period:   { month: monthNames[month - 1], year, from: from.toLocaleDateString("en-IN"), to: to.toLocaleDateString("en-IN") },
    attendance: { workingDays, totalHours: Math.round(totalHours * 10) / 10 },
    earnings: { basic, hra: hraAmt, conveyance: convAmt, medical: medAmt, bonus: bonusAmt, gross: grossSalary },
    deductions: { pf, esi, other: deductAmt, total: totalDeduct },
    netSalary,
    notes: notes || "",
    generatedAt: new Date().toISOString(),
    company: { name: "City Real Space", address: "A-708, Prahlad Nagar Trade Centre, Satellite, Ahmedabad - 380015", gstin: "24XXXXX0000X1ZX" },
  };

  return NextResponse.json(slip);
}

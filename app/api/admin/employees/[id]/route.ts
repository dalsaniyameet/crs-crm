import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

async function isAdmin(userId: string) {
  try {
    const dbUser = await prisma.user.findFirst({ where: { clerkId: userId }, select: { role: true, email: true } });
    if ((dbUser?.role as string)?.toUpperCase() === "ADMIN") return true;

    // Fallback: check ADMIN_EMAILS env
    const adminEmails = (process.env.ADMIN_EMAILS || "").split(",").map(e => e.trim().toLowerCase());
    if (dbUser?.email && adminEmails.includes(dbUser.email.toLowerCase())) {
      // Auto-fix role in DB
      await prisma.user.update({ where: { clerkId: userId }, data: { role: "ADMIN" } }).catch(() => {});
      return true;
    }

    // If no DB user at all, fetch from Clerk
    if (!dbUser) {
      const res = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
        headers: { Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}` },
      });
      const cu = await res.json();
      const email = cu?.email_addresses?.[0]?.email_address ?? "";
      if (adminEmails.includes(email.toLowerCase())) {
        const name = [cu?.first_name, cu?.last_name].filter(Boolean).join(" ") || "Admin";
        await prisma.user.upsert({
          where:  { clerkId: userId },
          update: { role: "ADMIN", email, name },
          create: { clerkId: userId, email, name, role: "ADMIN", avatar: cu?.image_url },
        }).catch(() => {});
        return true;
      }
    }
    return false;
  } catch { return false; }
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { userId } = await auth();
    if (!userId || !(await isAdmin(userId)))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const emp = await prisma.employeeProfile.findUnique({
      where: { id: params.id },
      include: { leaves: { orderBy: { createdAt: "desc" } } },
    });
    if (!emp) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

    // Attendance via Attendance model (userId)
    const attUser = await prisma.user.findUnique({ where: { email: emp.email }, select: { id: true } });
    let attendance: any[] = [];
    try {
      attendance = attUser ? await prisma.attendance.findMany({
        where: { userId: attUser.id },
        orderBy: { punchIn: "desc" },
        take: 60,
      }) : [];
    } catch {}

    // CRM data linked via User record
    const dbUser = await prisma.user.findUnique({ where: { email: emp.email } });
    
    let leads: any[] = [], deals: any[] = [], visits: any[] = [], activities: any[] = [];
    if (dbUser) {
      try { leads = await prisma.lead.findMany({ where: { assignedToId: dbUser.id }, orderBy: { createdAt: "desc" }, take: 20 }); } catch {}
      try {
        deals = await prisma.deal.findMany({
          where: { brokerId: dbUser.id },
          include: { lead: { select: { name: true } } },
          orderBy: { createdAt: "desc" }, take: 20,
        });
      } catch {}
      try {
        visits = await prisma.siteVisit.findMany({
          where: { brokerId: dbUser.id },
          include: { lead: { select: { name: true } }, property: { select: { title: true, locality: true } } },
          orderBy: { scheduledAt: "desc" }, take: 20,
        });
      } catch {}
      try { activities = await prisma.activity.findMany({ where: { userId: dbUser.id }, orderBy: { createdAt: "desc" }, take: 15 }); } catch {}
    }
    const stats = {
      totalLeads:  leads.length,
      totalDeals:  deals.length,
      closedDeals: deals.filter((d: any) => d.stage === "CLOSED").length,
      totalVisits: visits.length,
    };

    return NextResponse.json({ employee: emp, leaves: emp.leaves, attendance, leads, deals, visits, activities, stats });
  } catch (err: any) {
    console.error("Employee detail GET error:", err?.message);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params: _p }: { params: { id: string } }) {
  const { userId } = await auth();
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
  const attUser2 = await prisma.user.findUnique({ where: { email: emp.email }, select: { id: true } });
  const attendance = attUser2 ? await prisma.attendance.findMany({
    where: { userId: attUser2.id, punchIn: { gte: from, lte: to }, punchOut: { not: null } },
  }) : [];

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

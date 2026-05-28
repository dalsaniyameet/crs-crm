import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

async function getClerk() { return await clerkClient(); }
async function isAdmin(userId: string) {
  const clerk = await getClerk();
  const u = await clerk.users.getUser(userId);
  return (u.publicMetadata?.role as string)?.toUpperCase() === "ADMIN";
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId || !(await isAdmin(userId)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { employeeId, joiningDate, ctc, probationMonths = 3, reportingTo = "Management" } = await req.json();
  if (!employeeId || !joiningDate || !ctc)
    return NextResponse.json({ error: "employeeId, joiningDate, ctc required" }, { status: 400 });

  const emp = await prisma.employeeProfile.findUnique({ where: { id: employeeId } });
  if (!emp) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  const joining = new Date(joiningDate);
  const ctcNum  = Number(ctc);
  const monthly = Math.round(ctcNum / 12);
  const basic   = Math.round(monthly * 0.5);
  const hra     = Math.round(monthly * 0.2);
  const conv    = Math.round(monthly * 0.1);
  const other   = monthly - basic - hra - conv;

  const letter = {
    employee:       { name: emp.name, email: emp.email, position: emp.position, role: emp.role },
    joiningDate:    joining.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }),
    ctc,
    monthly,
    breakdown:      { basic, hra, conveyance: conv, otherAllowances: other },
    probationMonths,
    reportingTo,
    generatedAt:    new Date().toISOString(),
    company:        { name: "City Real Space", address: "A-708, Prahlad Nagar Trade Centre, Satellite, Ahmedabad - 380015", phone: "+91 79 XXXX XXXX", email: "hr@cityrealspace.com" },
  };

  return NextResponse.json(letter);
}

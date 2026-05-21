import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const { email, dob } = await req.json();
  if (!email || !dob) return NextResponse.json({ error: "Email and date of birth required" }, { status: 400 });

  let employee;
  try {
    employee = await prisma.employeeProfile.findUnique({ where: { email } });
  } catch {
    // Table may not exist yet — return 404 so sign-in falls back to Clerk direct login
    return NextResponse.json({ error: "No account found. Contact your admin." }, { status: 404 });
  }

  if (!employee || !employee.isActive)
    return NextResponse.json({ error: "No account found. Contact your admin." }, { status: 404 });

  const inputDob  = new Date(dob).toISOString().split("T")[0];
  const storedDob = employee.dob.toISOString().split("T")[0];

  if (inputDob !== storedDob)
    return NextResponse.json({ error: "Date of birth does not match." }, { status: 401 });

  return NextResponse.json({
    name:      employee.name,
    position:  employee.position,
    avatarUrl: employee.avatarUrl,
  });
}

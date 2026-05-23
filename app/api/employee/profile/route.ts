import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

// GET — fetch own employee profile
export async function GET() {
  const { userId } = auth();
  if (!userId) return NextResponse.json(null);

  try {
    const clerkUser = await clerkClient.users.getUser(userId);
    const email = clerkUser.emailAddresses[0]?.emailAddress;
    if (!email) return NextResponse.json(null);
    const emp = await prisma.employeeProfile.findUnique({ where: { email } });
    return NextResponse.json(emp || null);
  } catch {
    return NextResponse.json(null);
  }
}

// PATCH — update own avatar only
export async function PATCH(req: NextRequest) {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clerkUser = await clerkClient.users.getUser(userId);
  const email = clerkUser.emailAddresses[0]?.emailAddress;
  if (!email) return NextResponse.json({ error: "No email" }, { status: 400 });

  const { avatarUrl } = await req.json();
  if (!avatarUrl) return NextResponse.json({ error: "avatarUrl required" }, { status: 400 });

  const emp = await prisma.employeeProfile.findUnique({ where: { email } });
  if (!emp) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const updated = await prisma.employeeProfile.update({
    where: { email },
    data: { avatarUrl },
  });

  // sync to User table
  await prisma.user.updateMany({ where: { email }, data: { avatar: avatarUrl } });

  return NextResponse.json(updated);
}

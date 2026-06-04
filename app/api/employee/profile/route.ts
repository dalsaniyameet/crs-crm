import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

// GET — fetch own employee profile
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json(null);

  try {
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { email: true, name: true, role: true },
    });
    if (!user?.email) return NextResponse.json(null);

    const emp = await prisma.employeeProfile.findUnique({ where: { email: user.email } });
    return NextResponse.json(emp || null);
  } catch {
    return NextResponse.json(null);
  }
}

// POST — auto-create employee profile if not exists
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { email: true, name: true, role: true },
    });
    if (!user?.email) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const name = body.name || user.name || user.email.split("@")[0] || "Employee";

    // Upsert — create if not exists
    const emp = await prisma.employeeProfile.upsert({
      where:  { email: user.email },
      update: {},
      create: {
        name,
        email:    user.email,
        position: user.role || "BROKER",
        role:     (user.role as any) || "BROKER",
        dob:      new Date("2000-01-01"),
      },
    });
    return NextResponse.json(emp);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH — update own avatar, name, dob
export async function PATCH(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { email: true },
    });
    if (!user?.email) return NextResponse.json({ error: "No email" }, { status: 400 });

    const body = await req.json();
    const { avatarUrl, name, dob } = body;

    if (!avatarUrl && !name && !dob)
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

    const emp = await prisma.employeeProfile.findUnique({ where: { email: user.email } });
    if (!emp) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

    const updateData: any = {};
    if (avatarUrl) updateData.avatarUrl = avatarUrl;
    if (name?.trim()) {
      updateData.name = name.trim();
      await prisma.user.updateMany({ where: { email: user.email }, data: { name: name.trim() } });
      // Update Clerk name too
      try {
        const clerk = await clerkClient();
        const [firstName, ...rest] = name.trim().split(" ");
        await clerk.users.updateUser(userId, { firstName, lastName: rest.join(" ") || undefined });
      } catch { /* non-critical */ }
    }
    if (dob) updateData.dob = new Date(dob);

    const updated = await prisma.employeeProfile.update({
      where: { email: user.email },
      data:  updateData,
    });
    if (avatarUrl) {
      await prisma.user.updateMany({ where: { email: user.email }, data: { avatar: avatarUrl } });
    }
    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

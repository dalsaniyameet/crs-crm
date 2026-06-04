import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const me = await prisma.user.findUnique({ where: { clerkId: userId }, select: { role: true } });
  if (me?.role !== "ADMIN") return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, isActive: true, lastSeen: true, currentPage: true, clerkId: true },
    orderBy: { lastSeen: { sort: "desc", nulls: "last" } },
  });

  return NextResponse.json({
    total: users.length,
    now: new Date().toISOString(),
    users: users.map(u => ({
      name: u.name,
      email: u.email,
      role: u.role,
      isActive: u.isActive,
      clerkId: u.clerkId?.slice(0, 15) + "...",
      lastSeen: u.lastSeen?.toISOString() || null,
      minsAgo: u.lastSeen ? Math.floor((Date.now() - u.lastSeen.getTime()) / 60000) : null,
      currentPage: u.currentPage,
    })),
  });
}

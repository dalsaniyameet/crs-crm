import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = await prisma.user.findUnique({ where: { clerkId: userId } });
  if (!admin || admin.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const targetId = req.nextUrl.searchParams.get("userId");
  if (targetId) {
    const user = await prisma.user.findUnique({ where: { id: targetId }, select: { notifPrefs: true } });
    const prefs = (user?.notifPrefs as any) || {};
    return NextResponse.json({ allowedPages: prefs.allowedPages ?? null });
  }

  const users = await prisma.user.findMany({
    where: { role: { not: "ADMIN" } },
    select: { id: true, name: true, email: true, role: true, notifPrefs: true },
  });
  return NextResponse.json(users.map(u => ({
    id: u.id, name: u.name, email: u.email, role: u.role,
    allowedPages: ((u.notifPrefs as any)?.allowedPages) ?? null,
  })));
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = await prisma.user.findUnique({ where: { clerkId: userId } });
  if (!admin || admin.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId: targetId, allowedPages } = await req.json();
  if (!targetId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id: targetId } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const existing = (user.notifPrefs as any) || {};
  await prisma.user.update({
    where: { id: targetId },
    data: { notifPrefs: { ...existing, allowedPages: allowedPages ?? null } },
  });
  return NextResponse.json({ ok: true });
}

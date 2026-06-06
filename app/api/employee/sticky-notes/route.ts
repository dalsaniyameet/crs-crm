import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

async function getEmp(clerkId: string) {
  const user = await prisma.user.findUnique({ where: { clerkId }, select: { email: true } });
  if (!user?.email) return null;
  return prisma.employeeProfile.findUnique({ where: { email: user.email } });
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json([], { status: 401 });
  const emp = await getEmp(userId);
  if (!emp) return NextResponse.json([]);
  const notes = await prisma.stickyNote.findMany({
    where:   { employeeId: emp.id },
    orderBy: [{ isPinned: "desc" }, { updatedAt: "desc" }],
  });
  return NextResponse.json(notes);
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const emp = await getEmp(userId);
  if (!emp) return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  const { content, color } = await req.json();
  if (!content?.trim()) return NextResponse.json({ error: "Content required" }, { status: 400 });
  const note = await prisma.stickyNote.create({
    data: { employeeId: emp.id, content: content.trim(), color: color || "yellow" },
  });
  return NextResponse.json(note, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, content, color, isPinned } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const note = await prisma.stickyNote.update({
    where: { id },
    data: {
      ...(content !== undefined && { content }),
      ...(color   !== undefined && { color }),
      ...(isPinned !== undefined && { isPinned }),
      updatedAt: new Date(),
    },
  });
  return NextResponse.json(note);
}

export async function DELETE(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await req.json();
  await prisma.stickyNote.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

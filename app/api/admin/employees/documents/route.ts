import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs";
import { prisma } from "@/lib/prisma";

async function isAdmin(userId: string) {
  const u = await clerkClient.users.getUser(userId);
  return (u.publicMetadata?.role as string)?.toUpperCase() === "ADMIN";
}

// GET — list docs for an employee
export async function GET(req: NextRequest) {
  const { userId } = auth();
  if (!userId || !(await isAdmin(userId)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const empId = new URL(req.url).searchParams.get("employeeId");
  if (!empId) return NextResponse.json({ error: "employeeId required" }, { status: 400 });

  const docs = await prisma.employeeDocument.findMany({
    where: { employeeId: empId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(docs);
}

// POST — add a document record
export async function POST(req: NextRequest) {
  const { userId } = auth();
  if (!userId || !(await isAdmin(userId)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { employeeId, name, type, url, notes } = await req.json();
  if (!employeeId || !name || !url)
    return NextResponse.json({ error: "employeeId, name, url required" }, { status: 400 });

  const doc = await prisma.employeeDocument.create({
    data: { employeeId, name, type: type || "OTHER", url, notes },
  });
  return NextResponse.json(doc, { status: 201 });
}

// DELETE — remove a document
export async function DELETE(req: NextRequest) {
  const { userId } = auth();
  if (!userId || !(await isAdmin(userId)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await req.json();
  await prisma.employeeDocument.delete({ where: { id } });
  return NextResponse.json({ success: true });
}

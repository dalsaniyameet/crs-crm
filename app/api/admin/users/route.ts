import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const { userId } = auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, clerkId: true, name: true, email: true, role: true, isActive: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(users);
  } catch (err: any) {
    console.error("GET /api/admin/users error:", err?.message);
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { userId } = auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { clerkId, role } = await req.json();
    const validRoles = ["ADMIN", "BROKER", "SALES_MANAGER", "MARKETING"];
    if (!clerkId || !validRoles.includes(role))
      return NextResponse.json({ error: "Invalid data" }, { status: 400 });

    await Promise.all([
      clerkClient.users.updateUser(clerkId, { publicMetadata: { role } }),
      prisma.user.update({ where: { clerkId }, data: { role } }),
    ]);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("PATCH /api/admin/users error:", err?.message);
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}

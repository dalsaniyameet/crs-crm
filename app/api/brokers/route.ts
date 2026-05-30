import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const forAssign = url.searchParams.get("assign") === "1";

  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      ...(forAssign ? { role: { in: ["BROKER", "SALES_MANAGER"] } } : {}),
    },
    select:  { id: true, name: true, email: true, phone: true, avatar: true, role: true },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });

  return NextResponse.json(users);
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const brokers = await prisma.user.findMany({
    where:   { role: { in: ["BROKER", "SALES_MANAGER"] }, isActive: true },
    select:  { id: true, name: true, email: true, phone: true, avatar: true, role: true,
               _count: { select: { leads: true, deals: true } } },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(brokers);
}

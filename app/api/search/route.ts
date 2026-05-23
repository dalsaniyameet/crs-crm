import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q    = searchParams.get("q")    ?? "";
  const type = searchParams.get("type") ?? "all";

  if (!q) return NextResponse.json({ results: {} });

  const results: Record<string, unknown> = {};

  if (type === "all" || type === "leads") {
    results.leads = await prisma.lead.findMany({
      where: {
        OR: [
          { name:         { contains: q, mode: "insensitive" } },
          { phone:        { contains: q } },
          { email:        { contains: q, mode: "insensitive" } },
          { requirements: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true, name: true, phone: true, status: true, score: true },
      take: 5,
    });
  }

  if (type === "all" || type === "properties") {
    results.properties = await prisma.property.findMany({
      where: {
        OR: [
          { title:       { contains: q, mode: "insensitive" } },
          { locality:    { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true, title: true, locality: true, price: true, type: true, status: true },
      take: 5,
    });
  }

  if (type === "all" || type === "deals") {
    results.deals = await prisma.deal.findMany({
      where: {
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { lead:  { name: { contains: q, mode: "insensitive" } } },
        ],
      },
      select: { id: true, title: true, stage: true, value: true },
      take: 5,
    });
  }

  return NextResponse.json({ results, query: q });
}

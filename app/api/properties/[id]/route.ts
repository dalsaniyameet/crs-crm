import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const property = await prisma.property.findUnique({
      where: { id: params.id },
      include: {
        listedBy: { select: { id: true, name: true } },
        commercial: true,
        residential: true,
        matchedLeads: { include: { lead: { select: { id: true, name: true, phone: true, budget: true, transactionType: true } } }, take: 5, orderBy: { score: "desc" } },
      },
    });
    if (!property) return NextResponse.json({ error: "Not found" }, { status: 404 });
    // increment view count
    await prisma.property.update({ where: { id: params.id }, data: { viewCount: { increment: 1 } } });
    return NextResponse.json(property);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const { commercial, residential, ...propertyData } = body;

    const property = await prisma.property.update({
      where: { id: params.id },
      data: {
        ...propertyData,
        commercial: commercial
          ? { upsert: { create: commercial, update: commercial } }
          : undefined,
        residential: residential
          ? { upsert: { create: residential, update: residential } }
          : undefined,
      },
      include: { commercial: true, residential: true },
    });
    return NextResponse.json(property);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await prisma.property.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

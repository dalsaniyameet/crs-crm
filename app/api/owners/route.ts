import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page  = parseInt(searchParams.get("page")  || "1");
    const limit = parseInt(searchParams.get("limit") || "500");
    const owners = await prisma.propertyOwner.findMany({
      where:   { isActive: true },
      include: { properties: { select: { id: true, title: true, status: true, price: true, type: true, transactionType: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    });
    return NextResponse.json(owners);
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const owner = await prisma.propertyOwner.create({
      data: {
        name:         body.name         || "Unknown",
        phone:        body.phone,
        phone2:       body.phone2       || null,
        email:        body.email        || null,
        company:      body.company      || null,
        address:      body.address      || null,
        locality:     body.locality     || null,
        cardImageUrl: body.cardImageUrl || null,
        notes:        body.notes        || null,
      },
    });
    return NextResponse.json(owner, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

async function getUser(clerkId: string) {
  return prisma.user.findUnique({ where: { clerkId } });
}

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await getUser(userId);
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const { searchParams } = new URL(req.url);
    const page  = parseInt(searchParams.get("page")  || "1");
    const limit = parseInt(searchParams.get("limit") || "500");

    // BROKER — only see owners assigned to them by admin
    const where = user.role === "BROKER"
      ? { isActive: true, assignedToId: user.id }
      : { isActive: true };

    const owners = await prisma.propertyOwner.findMany({
      where,
      include: {
        properties: { select: { id: true, title: true, status: true, price: true, type: true, transactionType: true } },
        assignedTo: { select: { id: true, name: true } },
      },
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
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await getUser(userId);
    if (!user || user.role === "BROKER") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const body = await req.json();

    // Handle assign action — admin assigns owner to employee
    if (body._action === "assign") {
      const updated = await prisma.propertyOwner.update({
        where: { id: body.ownerId },
        data: { assignedToId: body.employeeId || null },
      });
      return NextResponse.json(updated);
    }

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
        assignedToId: body.assignedToId || null,
      },
    });
    return NextResponse.json(owner, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

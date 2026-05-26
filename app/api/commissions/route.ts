import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { notifyNewCommission } from "@/lib/notify";

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const commissions = await prisma.commission.findMany({
    include: {
      deal:   { select: { id: true, title: true, value: true } },
      broker: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(commissions);
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body       = await req.json();
  const commission = await prisma.commission.create({
    data:    body,
    include: { deal: true, broker: true },
  });

  notifyNewCommission({
    brokerName: commission.broker.name,
    dealTitle:  commission.deal.title,
    amount:     commission.amount,
    rate:       commission.rate,
    brokerId:   commission.brokerId,
  }).catch(() => {});

  return NextResponse.json(commission, { status: 201 });
}

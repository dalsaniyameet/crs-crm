import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { notifyNewDeal, notifyDealStageChange } from "@/lib/notify";

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const { searchParams } = new URL(req.url);
    const stage    = searchParams.get("stage");
    const brokerId = searchParams.get("brokerId");

    const where: Record<string, unknown> = {};
    if (stage) where.stage = stage;
    // Broker sirf apne deals dekhe
    if (user.role === "BROKER") where.brokerId = user.id;
    else if (brokerId) where.brokerId = brokerId;

    const deals = await prisma.deal.findMany({
      where,
      include: {
        lead:     { select: { id: true, name: true, phone: true } },
        property: { select: { id: true, title: true, locality: true } },
        broker:   { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json(deals);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const body = await req.json();

    // Broker sirf apne assigned lead ka deal bana sake
    if (user.role === "BROKER" && body.leadId) {
      const lead = await prisma.lead.findFirst({ where: { id: body.leadId, assignedToId: user.id } });
      if (!lead) return NextResponse.json({ error: "Access denied" }, { status: 403 });
      body.brokerId = user.id; // auto-assign broker
    }

    const deal = await prisma.deal.create({
      data: body,
      include: { lead: true, property: true, broker: true },
    });
    await prisma.activity.create({
      data: { type: "DEAL_CREATED", description: `New deal: ${deal.title}`, dealId: deal.id },
    });

    notifyNewDeal({
      title: deal.title, value: deal.value, stage: deal.stage,
      clientName: deal.lead.name, brokerName: deal.broker?.name,
      brokerId: deal.brokerId, leadId: deal.leadId,
    }).catch(() => {});

    return NextResponse.json(deal, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

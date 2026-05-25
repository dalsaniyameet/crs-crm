import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendAdminEmail, newDealEmailHtml } from "@/lib/email";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const stage    = searchParams.get("stage");
    const brokerId = searchParams.get("brokerId");

    const where: Record<string, unknown> = {};
    if (stage)    where.stage    = stage;
    if (brokerId) where.brokerId = brokerId;

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
    const body = await req.json();
    const deal = await prisma.deal.create({
      data: body,
      include: { lead: true, property: true, broker: true },
    });
    await prisma.activity.create({
      data: { type: "DEAL_CREATED", description: `New deal: ${deal.title}`, dealId: deal.id },
    });

    // Email notification to admin
    sendAdminEmail(
      `🤝 New Deal: ${deal.title} — ₹${body.value?.toLocaleString("en-IN")}`,
      newDealEmailHtml({
        title: deal.title,
        value: deal.value,
        stage: deal.stage,
        clientName: deal.lead.name,
        brokerName: deal.broker?.name,
      })
    ).catch(() => {});

    return NextResponse.json(deal, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

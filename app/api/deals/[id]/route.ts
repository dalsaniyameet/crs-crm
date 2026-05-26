import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyDealStageChange } from "@/lib/notify";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const deal = await prisma.deal.update({
      where: { id: params.id },
      data: body,
      include: {
        lead:     { select: { id: true, name: true, phone: true } },
        property: { select: { id: true, title: true, locality: true } },
        broker:   { select: { id: true, name: true } },
      },
    });

    if (body.stage) {
      await prisma.activity.create({
        data: {
          type: "DEAL_STAGE_CHANGED",
          description: `Deal "${deal.title}" moved to ${body.stage}`,
          dealId: deal.id,
        },
      });
      notifyDealStageChange({
        title: deal.title, stage: deal.stage, value: deal.value,
        clientName: deal.lead.name, brokerId: deal.brokerId, leadId: deal.leadId,
      }).catch(() => {});
    }

    return NextResponse.json(deal);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await prisma.deal.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

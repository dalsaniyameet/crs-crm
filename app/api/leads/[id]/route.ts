import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { autoMatchProperties } from "@/lib/autoMatch";
import { runLeadAutomation } from "@/lib/leadAutomation";

async function getUser(clerkId: string) {
  return prisma.user.findUnique({ where: { clerkId } });
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await getUser(userId);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const lead = await prisma.lead.findUnique({
    where: { id: params.id },
    include: {
      assignedTo:        { select: { id: true, name: true, avatar: true, phone: true } },
      deals:             { include: { property: true } },
      visits:            { include: { property: true } },
      activities:        { orderBy: { createdAt: "desc" }, take: 20 },
      tasks:             { where: { isCompleted: false }, orderBy: { dueAt: "asc" } },
      documents:         true,
      matchedProperties: { include: { property: { select: { id: true, title: true, locality: true, price: true, type: true, photos: true } } }, orderBy: { score: "desc" }, take: 5 },
    },
  });

  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  // BROKER can only view their own assigned leads
  if (user.role === "BROKER" && lead.assignedToId !== user.id) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  return NextResponse.json(lead);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await getUser(userId);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const existingLead = await prisma.lead.findUnique({ where: { id: params.id } });
  if (!existingLead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  // BROKER can only edit their own leads
  if (user.role === "BROKER" && existingLead.assignedToId !== user.id) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const body = await req.json();
  const updated = await prisma.lead.update({ where: { id: params.id }, data: body });

  await prisma.activity.create({
    data: {
      type:        "LEAD_UPDATED",
      description: `Lead updated: ${Object.keys(body).join(", ")}`,
      leadId:      updated.id,
      userId:      user.id,
    },
  });

  // ── Run full lifecycle automation on status change ──
  if (body.status && body.status !== existingLead.status) {
    runLeadAutomation({
      leadId:      updated.id,
      newStatus:   body.status,
      oldStatus:   existingLead.status,
      triggeredBy: user.id,
      extra:       body.extra,
    }).catch(console.error); // non-blocking
  }

  // Auto-create a deal when a lead moves into negotiation (legacy fallback)
  if (body.status === "NEGOTIATION" && existingLead.status !== "NEGOTIATION") {
    const existingDeal = await prisma.deal.findFirst({
      where: { leadId: updated.id, stage: { notIn: ["CLOSED", "CANCELLED"] } },
    });

    if (!existingDeal) {
      const dealValue = updated.budget ?? 500000;
      const commissionRate = 2;
      const commission = Math.max(0, Math.round(dealValue * commissionRate / 100));

      const deal = await prisma.deal.create({
        data: {
          title:          `${updated.name} - Negotiation Deal`,
          leadId:         updated.id,
          stage:          "NEGOTIATION",
          value:          dealValue,
          commissionRate,
          commission,
          brokerId:       updated.assignedToId || undefined,
          notes:          "Auto-created when lead moved to Negotiation.",
        },
      });

      await prisma.activity.create({
        data: {
          type:        "DEAL_AUTO_CREATED",
          description: `Deal auto-created for lead ${updated.name}`,
          leadId:      updated.id,
          dealId:      deal.id,
          userId:      user.id,
        },
      });
    }
  }

  // Re-run auto-match if requirements or propertyType changed
  if (body.requirements || body.propertyType || body.transactionType || body.budget) {
    autoMatchProperties(updated.id).catch(() => {});
  }

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await getUser(userId);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Only ADMIN or SALES_MANAGER can delete leads
  if (user.role === "BROKER") {
    return NextResponse.json({ error: "Only admins can delete leads" }, { status: 403 });
  }

  await prisma.lead.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}

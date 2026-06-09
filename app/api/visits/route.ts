import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { sendSiteVisitReminder } from "@/lib/whatsapp";
import { notifyNewVisit, notifyVisitFollowUpForAdmin } from "@/lib/notify";

async function getUser(clerkId: string) {
  return prisma.user.findUnique({ where: { clerkId } });
}

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await getUser(userId);
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const isBroker = user.role === "BROKER";

    const visits = await prisma.siteVisit.findMany({
      where: isBroker ? { brokerId: user.id } : {},
      include: {
        lead:     { select: { id: true, name: true, phone: true, budget: true, requirements: true } },
        property: { select: { id: true, title: true, locality: true, city: true, ownerName: true, ownerPhone: true, price: true, transactionType: true, address: true } },
        broker:   { select: { id: true, name: true } },
      },
      orderBy: { scheduledAt: "asc" },
    });
    return NextResponse.json(visits);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await getUser(userId);
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Broker can only create visits for their assigned leads
    const body = await req.json();

    if (user.role === "BROKER") {
      const lead = await prisma.lead.findFirst({ where: { id: body.leadId, assignedToId: user.id } });
      if (!lead) return NextResponse.json({ error: "Access denied — lead not assigned to you" }, { status: 403 });
    }

    const visit = await prisma.siteVisit.create({
      data: body,
      include: { lead: true, property: true, broker: true },
    });

    const scheduledAt = new Date(body.scheduledAt);
    const diffMs = scheduledAt.getTime() - Date.now();
    if (diffMs <= 2 * 60 * 60 * 1000 && diffMs >= 0) {
      sendSiteVisitReminder({
        clientName:    visit.lead.name,
        clientPhone:   visit.lead.phone,
        propertyTitle: (visit.property as any)?.title || "Property",
        scheduledAt,
        brokerName:    (visit.broker as any)?.name || "City Real Space",
      }).catch(() => {});
    }

    notifyNewVisit({
      clientName:    visit.lead.name,
      clientPhone:   visit.lead.phone,
      propertyTitle: (visit.property as any)?.title || "Property",
      scheduledAt:   scheduledAt.toLocaleString("en-IN", { dateStyle: "full", timeStyle: "short" }),
      brokerName:    (visit.broker as any)?.name || "City Real Space",
      brokerId:      visit.brokerId,
      leadId:        visit.leadId,
    }).catch(() => {});

    // Notify admin separately with owner details for follow-up tracking
    notifyVisitFollowUpForAdmin({
      leadId:        visit.leadId,
      leadName:      visit.lead.name,
      leadPhone:     visit.lead.phone,
      employeeName:  (visit.broker as any)?.name || "Unknown Employee",
      employeeId:    visit.brokerId,
      propertyTitle: (visit.property as any)?.title || "Property",
      ownerName:     (visit.property as any)?.ownerName || null,
      ownerPhone:    (visit.property as any)?.ownerPhone || null,
      scheduledAt:   scheduledAt.toLocaleString("en-IN", { dateStyle: "full", timeStyle: "short" }),
    }).catch(() => {});

    return NextResponse.json(visit, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

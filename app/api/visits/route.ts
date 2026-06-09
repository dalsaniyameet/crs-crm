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

    const body = await req.json();

    if (user.role === "BROKER") {
      const lead = await prisma.lead.findFirst({ where: { id: body.leadId, assignedToId: user.id } });
      if (!lead) return NextResponse.json({ error: "Access denied — lead not assigned to you" }, { status: 403 });
    }

    // If manual property provided, auto-save it to Properties table
    let resolvedPropertyId = body.propertyId || null;
    if (!resolvedPropertyId && body.customPropertyName) {
      try {
        const newProp = await prisma.property.create({
          data: {
            title:           body.customPropertyName,
            type:            "OFFICE" as any,
            category:        "COMMERCIAL" as any,
            transactionType: "RENT" as any,
            status:          "AVAILABLE" as any,
            price:           body.customPropertyPrice || 0,
            area:            0,
            locality:        body.customPropertyLocality || "Ahmedabad",
            city:            "Ahmedabad",
            ownerName:       body.customPropertyOwnerName || null,
            ownerPhone:      body.customPropertyOwnerPhone || null,
            listedById:      user.id,
          },
        });
        resolvedPropertyId = newProp.id;
      } catch {}
    }

    const visit = await prisma.siteVisit.create({
      data: {
        leadId:      body.leadId,
        propertyId:  resolvedPropertyId,
        brokerId:    body.brokerId || null,
        scheduledAt: new Date(body.scheduledAt),
        status:      "SCHEDULED",
        notes:       body.notes || null,
        customPropertyName:       body.customPropertyName || null,
        customPropertyLocality:   body.customPropertyLocality || null,
        customPropertyOwnerName:  body.customPropertyOwnerName || null,
        customPropertyOwnerPhone: body.customPropertyOwnerPhone || null,
        customPropertyPrice:      body.customPropertyPrice ? Number(body.customPropertyPrice) : null,
      },
      include: { lead: true, property: true, broker: true },
    });

    // Auto-update lead status to SITE_VISIT_SCHEDULED
    await prisma.lead.update({
      where: { id: body.leadId },
      data: { status: "SITE_VISIT_SCHEDULED" as any },
    }).catch(() => {});

    // Log activity on lead
    const propName = visit.property?.title || body.customPropertyName || "Property";
    await prisma.activity.create({
      data: {
        type:        "SITE_VISIT_SCHEDULED",
        description: `Site visit scheduled for ${visit.lead.name} at "${propName}" on ${new Date(body.scheduledAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}`,
        leadId:      body.leadId,
        userId:      user.id,
      },
    }).catch(() => {});

    const scheduledAt = new Date(body.scheduledAt);
    const diffMs = scheduledAt.getTime() - Date.now();
    if (diffMs <= 2 * 60 * 60 * 1000 && diffMs >= 0) {
      sendSiteVisitReminder({
        clientName:    visit.lead.name,
        clientPhone:   visit.lead.phone,
        propertyTitle: propName,
        scheduledAt,
        brokerName:    (visit.broker as any)?.name || "City Real Space",
      }).catch(() => {});
    }

    notifyNewVisit({
      clientName:    visit.lead.name,
      clientPhone:   visit.lead.phone,
      propertyTitle: propName,
      scheduledAt:   scheduledAt.toLocaleString("en-IN", { dateStyle: "full", timeStyle: "short" }),
      brokerName:    (visit.broker as any)?.name || "City Real Space",
      brokerId:      visit.brokerId,
      leadId:        visit.leadId,
    }).catch(() => {});

    notifyVisitFollowUpForAdmin({
      leadId:        visit.leadId,
      leadName:      visit.lead.name,
      leadPhone:     visit.lead.phone,
      employeeName:  (visit.broker as any)?.name || "Unknown Employee",
      employeeId:    visit.brokerId,
      propertyTitle: propName,
      ownerName:     visit.property?.ownerName || body.customPropertyOwnerName || null,
      ownerPhone:    visit.property?.ownerPhone || body.customPropertyOwnerPhone || null,
      scheduledAt:   scheduledAt.toLocaleString("en-IN", { dateStyle: "full", timeStyle: "short" }),
    }).catch(() => {});

    return NextResponse.json(visit, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

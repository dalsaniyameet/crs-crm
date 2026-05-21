import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendSiteVisitReminder } from "@/lib/whatsapp";

export async function GET(req: NextRequest) {
  try {
    const visits = await prisma.siteVisit.findMany({
      include: {
        lead:     { select: { id: true, name: true, phone: true } },
        property: { select: { id: true, title: true, locality: true } },
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
    const body  = await req.json();
    const visit = await prisma.siteVisit.create({
      data: body,
      include: { lead: true, property: true, broker: true },
    });

    const scheduledAt = new Date(body.scheduledAt);
    const now = new Date();
    const diffMs = scheduledAt.getTime() - now.getTime();
    const twoHours = 2 * 60 * 60 * 1000;

    if (diffMs <= twoHours && diffMs >= 0) {
      try {
        await sendSiteVisitReminder({
          clientName:  visit.lead.name,
          clientPhone: visit.lead.phone,
          propertyTitle: visit.property?.title || "Property",
          scheduledAt,
          brokerName: visit.broker?.name || "City Real Space",
        });
      } catch {
        // best effort only
      }
    }

    return NextResponse.json(visit, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

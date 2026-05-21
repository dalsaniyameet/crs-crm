import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { type, leadIds } = await req.json();

    if (!leadIds?.length) return NextResponse.json({ error: "No leads selected" }, { status: 400 });

    const leads = await prisma.lead.findMany({
      where: { id: { in: leadIds } },
      select: { id: true, name: true, phone: true, email: true },
    });

    // Log activity for each lead
    await prisma.activity.createMany({
      data: leads.map(lead => ({
        type: "NOTE_ADDED",
        description: `Bulk ${type.toUpperCase()} sent to ${lead.name}`,
        leadId: lead.id,
      })),
    });

    // TODO: Wire actual Twilio WhatsApp/SMS or email sending here
    return NextResponse.json({ success: true, sent: leads.length, type });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

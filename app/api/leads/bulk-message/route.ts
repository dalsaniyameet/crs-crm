import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendWhatsApp } from "@/lib/whatsapp";

export async function POST(req: NextRequest) {
  try {
    const { type, leadIds, message } = await req.json();

    if (!leadIds?.length) return NextResponse.json({ error: "No leads selected" }, { status: 400 });

    const leads = await prisma.lead.findMany({
      where: { id: { in: leadIds } },
      select: { id: true, name: true, phone: true },
    });

    const defaultMsg = `Hi! 👋\n\nThis is City Real Space, Ahmedabad.\n\nWe have exciting property options for you. Please reply to know more!\n\n📞 City Real Space | Ahmedabad`;
    const msgText = message || defaultMsg;

    const results = await Promise.allSettled(
      leads.filter(l => l.phone).map(lead => sendWhatsApp(lead.phone, msgText))
    );

    const sent   = results.filter(r => r.status === "fulfilled").length;
    const failed = results.filter(r => r.status === "rejected").length;

    await prisma.activity.createMany({
      data: leads.map(lead => ({
        type:        "WHATSAPP_SENT",
        description: `Bulk WhatsApp sent to ${lead.name}`,
        leadId:      lead.id,
      })),
    });

    return NextResponse.json({ success: true, sent, failed, total: leads.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

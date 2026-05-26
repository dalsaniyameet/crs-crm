import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendWhatsApp } from "@/lib/whatsapp";
import { sendAdminEmail, newLeadEmailHtml, newLeadMessageEmailHtml } from "@/lib/email";

export async function POST(req: NextRequest) {
  const body        = await req.formData();
  const from        = body.get("From")        as string;
  const messageBody = body.get("Body")        as string;
  const profileName = body.get("ProfileName") as string;
  const mediaUrl    = body.get("MediaUrl0")   as string | null;

  const phone = from.replace("whatsapp:+91", "").replace("whatsapp:+", "").replace(/\D/g, "").slice(-10);

  // Check if this is a property owner replying
  const owner = await prisma.propertyOwner.findFirst({
    where: { phone: { endsWith: phone } },
  });

  if (owner) {
    await prisma.ownerMessage.create({
      data: { ownerId: owner.id, direction: "IN", message: messageBody || "", mediaUrl: mediaUrl || null },
    });
    // Notify admins about owner message
    const admins = await prisma.user.findMany({ where: { role: "ADMIN", isActive: true }, select: { id: true } });
    await Promise.all(admins.map(a => prisma.notification.create({
      data: { userId: a.id, type: "WHATSAPP", title: `Owner Message: ${owner.name}`, message: messageBody || "(media)" },
    }).catch(() => {})));
    sendAdminEmail(
      `WhatsApp from Owner: ${owner.name}`,
      newLeadMessageEmailHtml({ leadName: owner.name, leadPhone: phone, message: messageBody || "(media)", channel: "WhatsApp (Owner)" })
    ).catch(() => {});
    return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`, { headers: { "Content-Type": "text/xml" } });
  }

  // Otherwise treat as lead
  let lead = await prisma.lead.findFirst({ where: { phone } });

  if (!lead) {
    lead = await prisma.lead.create({
      data: { name: profileName || "WhatsApp Lead", phone, source: "WHATSAPP", requirements: messageBody, status: "NEW" },
    });
    await sendWhatsApp(phone,
      `Hi ${profileName || "there"}! 👋\n\nThank you for contacting *City Real Space*, Ahmedabad.\n\nA broker will get back to you shortly.\n\nPlease share:\n1. Property type\n2. Budget\n3. Preferred location\n\n🏠 City Real Space | Ahmedabad`
    );
    // Notify admins — new WhatsApp lead
    const admins = await prisma.user.findMany({ where: { role: "ADMIN", isActive: true }, select: { id: true } });
    await Promise.all(admins.map(a => prisma.notification.create({
      data: { userId: a.id, type: "WHATSAPP", title: `New WhatsApp Lead: ${profileName || phone}`, message: messageBody || "New inquiry" },
    }).catch(() => {})));
    sendAdminEmail(
      `New WhatsApp Lead: ${profileName || phone}`,
      newLeadEmailHtml({ name: profileName || "WhatsApp Lead", phone, source: "WHATSAPP", requirements: messageBody, score: 60 })
    ).catch(() => {});
  } else {
    await prisma.activity.create({
      data: { type: "WHATSAPP_RECEIVED", description: `WhatsApp: ${messageBody?.substring(0, 100)}`, leadId: lead.id },
    });
    // Notify admins — existing lead replied
    const admins = await prisma.user.findMany({ where: { role: "ADMIN", isActive: true }, select: { id: true } });
    await Promise.all(admins.map(a => prisma.notification.create({
      data: { userId: a.id, type: "WHATSAPP", title: `WhatsApp Reply: ${lead!.name}`, message: messageBody || "(media)", leadId: lead!.id },
    }).catch(() => {})));
    sendAdminEmail(
      `WhatsApp Reply from Lead: ${lead.name}`,
      newLeadMessageEmailHtml({ leadName: lead.name, leadPhone: phone, message: messageBody || "(media)", channel: "WhatsApp" })
    ).catch(() => {});
  }

  return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`, { headers: { "Content-Type": "text/xml" } });
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendWhatsApp } from "@/lib/whatsapp";
import { sendAdminEmail, newLeadEmailHtml, newLeadMessageEmailHtml } from "@/lib/email";

const XML_EMPTY = `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;
const XML_HEADERS = { "Content-Type": "text/xml" };

// Check owner-client match: if owner replied, find active leads matching their property type
async function checkOwnerClientMatch(ownerId: string, ownerName: string) {
  try {
    const ownerProps = await prisma.property.findMany({
      where:  { ownerId },
      select: { type: true, transactionType: true, price: true, title: true, locality: true },
    });
    if (!ownerProps.length) return;

    for (const prop of ownerProps) {
      const matchingLeads = await prisma.lead.findMany({
        where: {
          status:          { notIn: ["DEAL_CLOSED", "LOST"] },
          propertyType:    prop.type    || undefined,
          transactionType: prop.transactionType || undefined,
          ...(prop.price ? { budget: { gte: prop.price * 0.8 } } : {}),
        },
        select: { id: true, name: true, phone: true, requirements: true },
        take: 5,
      });

      if (!matchingLeads.length) continue;

      // Notify admins with match alert
      const admins = await prisma.user.findMany({ where: { role: "ADMIN", isActive: true }, select: { id: true } });
      await Promise.all(admins.map(a =>
        prisma.notification.create({
          data: {
            userId:  a.id,
            type:    "PROPERTY_MATCH",
            title:   `🔥 Owner-Client Match! ${ownerName}`,
            message: `Owner *${ownerName}* replied. Property "${prop.title}" matches ${matchingLeads.length} active lead(s)! Check WP Inbox.`,
            metadata: {
              ownerId,
              propertyTitle: prop.title,
              matchedLeads:  matchingLeads.map(l => ({ id: l.id, name: l.name })),
            },
          },
        }).catch(() => {})
      ));
    }
  } catch {}
}

export async function POST(req: NextRequest) {
  const body        = await req.formData();
  const from        = body.get("From")        as string;
  const toNumber    = body.get("To")          as string; // which of our 4 WP numbers
  const messageBody = body.get("Body")        as string;
  const profileName = body.get("ProfileName") as string;
  const mediaUrl    = body.get("MediaUrl0")   as string | null;

  const phone    = from.replace("whatsapp:+91", "").replace("whatsapp:+", "").replace(/\D/g, "").slice(-10);
  const ourPhone = toNumber.replace("whatsapp:+91", "").replace("whatsapp:+", "").replace(/\D/g, "").slice(-10);

  // Find which WP number received this message
  const wpNumber = await prisma.wpNumber.findFirst({ where: { number: { endsWith: ourPhone } } });

  // Identify sender — owner or lead
  const owner = await prisma.propertyOwner.findFirst({ where: { phone: { endsWith: phone } } });
  const lead  = await prisma.lead.findFirst({ where: { phone } });

  // Save to WP Inbox (all messages from all 4 numbers)
  if (wpNumber) {
    await prisma.wpInbox.create({
      data: {
        wpNumberId:      wpNumber.id,
        fromPhone:       phone,
        fromName:        profileName || owner?.name || lead?.name || null,
        message:         messageBody || null,
        mediaUrl:        mediaUrl    || null,
        matchedLeadId:   lead?.id    || null,
        matchedOwnerId:  owner?.id   || null,
      },
    }).catch(() => {});
  }

  // ── Owner replied ──
  if (owner) {
    await prisma.ownerMessage.create({
      data: { ownerId: owner.id, direction: "IN", message: messageBody || "", mediaUrl: mediaUrl || null },
    });
    // Check if owner's property matches any active client
    checkOwnerClientMatch(owner.id, owner.name).catch(() => {});

    const admins = await prisma.user.findMany({ where: { role: "ADMIN", isActive: true }, select: { id: true } });
    await Promise.all(admins.map(a => prisma.notification.create({
      data: { userId: a.id, type: "WHATSAPP", title: `📩 Owner Reply: ${owner.name}`, message: messageBody || "(media)" },
    }).catch(() => {})));
    sendAdminEmail(
      `WhatsApp from Owner: ${owner.name}`,
      newLeadMessageEmailHtml({ leadName: owner.name, leadPhone: phone, message: messageBody || "(media)", channel: "WhatsApp (Owner)" })
    ).catch(() => {});
    return new NextResponse(XML_EMPTY, { headers: XML_HEADERS });
  }

  // ── Lead / new client ──
  if (!lead) {
    const newLead = await prisma.lead.create({
      data: { name: profileName || "WhatsApp Lead", phone, source: "WHATSAPP", requirements: messageBody, status: "NEW" },
    });
    // Update inbox with new lead id
    if (wpNumber) await prisma.wpInbox.updateMany({ where: { fromPhone: phone, matchedLeadId: null }, data: { matchedLeadId: newLead.id } }).catch(() => {});

    await sendWhatsApp(phone,
      `Hi ${profileName || "there"}! 👋\n\nThank you for contacting *City Real Space*, Ahmedabad.\n\nA broker will get back to you shortly.\n\nPlease share:\n1. Property type\n2. Budget\n3. Preferred location\n\n🏠 City Real Space | Ahmedabad`
    );
    const admins = await prisma.user.findMany({ where: { role: "ADMIN", isActive: true }, select: { id: true } });
    await Promise.all(admins.map(a => prisma.notification.create({
      data: { userId: a.id, type: "WHATSAPP", title: `🆕 New WP Lead: ${profileName || phone}`, message: messageBody || "New inquiry", leadId: newLead.id },
    }).catch(() => {})));
    sendAdminEmail(
      `New WhatsApp Lead: ${profileName || phone}`,
      newLeadEmailHtml({ name: profileName || "WhatsApp Lead", phone, source: "WHATSAPP", requirements: messageBody, score: 60 })
    ).catch(() => {});
  } else {
    await prisma.activity.create({
      data: { type: "WHATSAPP_RECEIVED", description: `WhatsApp: ${messageBody?.substring(0, 100)}`, leadId: lead.id },
    });
    const admins = await prisma.user.findMany({ where: { role: "ADMIN", isActive: true }, select: { id: true } });
    await Promise.all(admins.map(a => prisma.notification.create({
      data: { userId: a.id, type: "WHATSAPP", title: `💬 WP Reply: ${lead.name}`, message: messageBody || "(media)", leadId: lead.id },
    }).catch(() => {})));
    sendAdminEmail(
      `WhatsApp Reply from Lead: ${lead.name}`,
      newLeadMessageEmailHtml({ leadName: lead.name, leadPhone: phone, message: messageBody || "(media)", channel: "WhatsApp" })
    ).catch(() => {});
  }

  return new NextResponse(XML_EMPTY, { headers: XML_HEADERS });
}

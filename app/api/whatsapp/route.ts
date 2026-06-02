import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendWhatsApp } from "@/lib/whatsapp";
import { sendAdminEmail, newLeadEmailHtml, newLeadMessageEmailHtml } from "@/lib/email";

// ── WATI Webhook payload shape ──
// { waId, senderName, text: { body }, type, media: { url } }

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
        select: { id: true, name: true, phone: true },
        take: 5,
      });
      if (!matchingLeads.length) continue;

      const admins = await prisma.user.findMany({ where: { role: "ADMIN", isActive: true }, select: { id: true } });
      await Promise.all(admins.map(a =>
        prisma.notification.create({
          data: {
            userId:  a.id,
            type:    "PROPERTY_MATCH",
            title:   `🔥 Owner-Client Match! ${ownerName}`,
            message: `Owner *${ownerName}* replied. Property "${prop.title}" matches ${matchingLeads.length} active lead(s)!`,
            metadata: { ownerId, propertyTitle: prop.title, matchedLeads: matchingLeads.map(l => ({ id: l.id, name: l.name })) },
          },
        }).catch(() => {})
      ));
    }
  } catch {}
}

export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: true }); }

  // WATI webhook format
  const phone       = (body.waId || "").replace(/\D/g, "").slice(-10);
  const profileName = body.senderName || "";
  const messageBody = body.text?.body || body.caption || "";
  const mediaUrl    = body.media?.url || null;

  if (!phone) return NextResponse.json({ ok: true });

  // Find WP number that received this (WATI sends whatsappNumber in payload)
  const ourPhone = (body.whatsappNumber || "").replace(/\D/g, "").slice(-10);
  const wpNumber = ourPhone
    ? await prisma.wpNumber.findFirst({ where: { number: { endsWith: ourPhone } } })
    : null;

  const owner = await prisma.propertyOwner.findFirst({ where: { phone: { endsWith: phone } } });
  const lead  = await prisma.lead.findFirst({ where: { phone } });

  // Save to WP Inbox
  if (wpNumber) {
    await prisma.wpInbox.create({
      data: {
        wpNumberId:     wpNumber.id,
        fromPhone:      phone,
        fromName:       profileName || owner?.name || lead?.name || null,
        message:        messageBody || null,
        mediaUrl:       mediaUrl    || null,
        matchedLeadId:  lead?.id    || null,
        matchedOwnerId: owner?.id   || null,
      },
    }).catch(() => {});
  }

  // ── Owner replied ──
  if (owner) {
    await prisma.ownerMessage.create({
      data: { ownerId: owner.id, direction: "IN", message: messageBody || "", mediaUrl: mediaUrl || null },
    });
    checkOwnerClientMatch(owner.id, owner.name).catch(() => {});

    const admins = await prisma.user.findMany({ where: { role: "ADMIN", isActive: true }, select: { id: true } });
    await Promise.all(admins.map(a => prisma.notification.create({
      data: { userId: a.id, type: "WHATSAPP", title: `📩 Owner Reply: ${owner.name}`, message: messageBody || "(media)" },
    }).catch(() => {})));
    sendAdminEmail(
      `WhatsApp from Owner: ${owner.name}`,
      newLeadMessageEmailHtml({ leadName: owner.name, leadPhone: phone, message: messageBody || "(media)", channel: "WhatsApp (Owner)" })
    ).catch(() => {});
    return NextResponse.json({ ok: true });
  }

  // ── New lead ──
  if (!lead) {
    const newLead = await prisma.lead.create({
      data: { name: profileName || "WhatsApp Lead", phone, source: "WHATSAPP", requirements: messageBody, status: "NEW" },
    });
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

  return NextResponse.json({ ok: true });
}

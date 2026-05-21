import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendWhatsApp } from "@/lib/whatsapp";

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
    // Save owner's reply
    await prisma.ownerMessage.create({
      data: {
        ownerId:   owner.id,
        direction: "IN",
        message:   messageBody || "",
        mediaUrl:  mediaUrl || null,
      },
    });

    return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`, {
      headers: { "Content-Type": "text/xml" },
    });
  }

  // Otherwise treat as lead
  let lead = await prisma.lead.findFirst({ where: { phone } });

  if (!lead) {
    lead = await prisma.lead.create({
      data: {
        name:         profileName || "WhatsApp Lead",
        phone,
        source:       "WHATSAPP",
        requirements: messageBody,
        status:       "NEW",
      },
    });

    await sendWhatsApp(phone,
      `Hi ${profileName || "there"}! 👋\n\nThank you for contacting *City Real Space*, Ahmedabad.\n\nA broker will get back to you shortly.\n\nPlease share:\n1. Property type\n2. Budget\n3. Preferred location\n\n🏠 City Real Space | Ahmedabad`
    );
  } else {
    await prisma.activity.create({
      data: {
        type:        "WHATSAPP_RECEIVED",
        description: `WhatsApp: ${messageBody?.substring(0, 100)}`,
        leadId:      lead.id,
      },
    });
  }

  return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`, {
    headers: { "Content-Type": "text/xml" },
  });
}

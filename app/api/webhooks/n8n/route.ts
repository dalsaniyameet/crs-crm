import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { scoreLeadAI } from "@/lib/openai";
import { sendWhatsApp } from "@/lib/whatsapp";
import { sendNewLeadEmail } from "@/lib/email";

const SOURCE_MAP: Record<string, string> = {
  whatsapp:    "WHATSAPP",
  facebook:    "FACEBOOK",
  instagram:   "FACEBOOK",
  fb_ads:      "FACEBOOK",
  google:      "GOOGLE_BUSINESS",
  google_ads:  "GOOGLE_BUSINESS",
  website:     "WEBSITE",
  "99acres":   "ACRES99",
  acres99:     "ACRES99",
  magicbricks: "MAGICBRICKS",
  housing:     "HOUSING",
  referral:    "REFERRAL",
  justdial:    "OTHER",
  indiamart:   "OTHER",
  walk_in:     "WALK_IN",
  cold_call:   "COLD_CALL",
};

function welcomeMsg(name: string, source: string, requirements: string) {
  const src =
    source === "FACEBOOK"        ? "Facebook" :
    source === "GOOGLE_BUSINESS" ? "Google" :
    source === "ACRES99"         ? "99acres" :
    source === "MAGICBRICKS"     ? "MagicBricks" :
    source === "HOUSING"         ? "Housing.com" :
    source === "WHATSAPP"        ? "WhatsApp" : "our platform";

  return `Hi ${name}! 👋\n\nThank you for your inquiry via *${src}*.\n\nWe at *City Real Space, Ahmedabad* have received your requirement:\n📋 _${requirements || "Property inquiry"}_\n\nA dedicated broker will call you within *30 minutes*.\n\nMeanwhile, please share:\n1️⃣ Your budget range\n2️⃣ Preferred area/locality\n3️⃣ Ready to move or under construction?\n\n🏠 *City Real Space* | Ahmedabad's Trusted Real Estate Brokers`;
}

export async function POST(req: NextRequest) {
  try {
    // Secret token check
    const token    = req.headers.get("x-n8n-token") || req.nextUrl.searchParams.get("token");
    const expected = process.env.N8N_WEBHOOK_SECRET;
    if (expected && token !== expected) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    // Normalize fields — n8n sends different shapes per source
    const name = (
      body.name || body.full_name || body.customer_name || body.lead_name ||
      body.field_data?.find((f: any) => f.name === "full_name")?.values?.[0] ||
      "Lead"
    ).trim();

    const rawPhone =
      body.phone || body.mobile || body.contact_number ||
      body.phone_number || body.whatsapp_number ||
      body.field_data?.find((f: any) => f.name === "phone_number")?.values?.[0] || "";
    const phone = rawPhone.toString().replace(/\D/g, "").slice(-10);

    const email =
      body.email || body.email_id ||
      body.field_data?.find((f: any) => f.name === "email")?.values?.[0] || null;

    const requirements =
      body.requirements || body.message || body.query ||
      body.property_type || body.notes ||
      body.field_data?.find((f: any) => f.name === "message")?.values?.[0] ||
      "Property inquiry";

    const budget       = parseFloat(body.budget || body.price_range || "0") || null;
    const rawSource    = (body.source || body.platform || body.channel || body.portal || "website").toLowerCase();
    const source       = SOURCE_MAP[rawSource] || "OTHER";
    const propertyType = body.property_type || body.propertyType || null;
    const locality     = body.locality || body.location || body.area || null;

    if (!phone || phone.length < 10) {
      return NextResponse.json({ error: "Valid 10-digit phone required" }, { status: 400 });
    }

    // Duplicate check
    const existing = await prisma.lead.findFirst({ where: { phone, isDuplicate: false } });
    if (existing) {
      await prisma.activity.create({
        data: {
          type:        "N8N_DUPLICATE",
          description: `Duplicate n8n lead from ${source}: ${requirements}`,
          leadId:      existing.id,
          metadata:    { source, raw: body },
        },
      });
      try {
        await sendWhatsApp(phone,
          `Hi ${existing.name}! 👋 We noticed your inquiry again. A broker from *City Real Space* will call you shortly. 🏠`
        );
      } catch {}
      return NextResponse.json({ status: "duplicate", leadId: existing.id });
    }

    // AI Score
    let aiScore = { score: 60, probability: 0.4, reasoning: "" };
    try {
      aiScore = await scoreLeadAI({ budget, requirements, source, propertyType, transactionType: body.transactionType || null });
    } catch {}

    // Create lead
    const lead = await prisma.lead.create({
      data: {
        name,
        phone,
        email,
        source:          source as any,
        status:          "NEW",
        requirements,
        budget,
        preferredAreas:  locality ? [locality] : [],
        propertyType:    propertyType as any || null,
        score:           aiScore.score,
        dealProbability: aiScore.probability,
        nextFollowUpAt:  new Date(Date.now() + 2 * 60 * 60 * 1000),
        utmSource:       rawSource,
        utmMedium:       body.utm_medium  || null,
        utmCampaign:     body.utm_campaign || body.ad_name || null,
      },
    });

    await prisma.activity.create({
      data: {
        type:        "N8N_LEAD",
        description: `New lead via n8n (${source}): ${name} — ${requirements}`,
        leadId:      lead.id,
        metadata:    { source, aiScore, raw: body },
      },
    });

    // Instant WhatsApp welcome
    try { await sendWhatsApp(phone, welcomeMsg(name, source, requirements)); } catch {}

    // Email notification to admin
    try { await sendNewLeadEmail({ name, phone, email, source, requirements, score: aiScore.score }); } catch {}

    // Auto follow-up tasks
    await prisma.task.createMany({
      data: [
        {
          title:       `📞 Call ${name} (${source})`,
          dueAt:       new Date(Date.now() + 30 * 60 * 1000),
          priority:    "HIGH",
          leadId:      lead.id,
          description: `New lead from ${source}. Requirements: ${requirements}`,
        },
        {
          title:       `💬 WhatsApp follow-up — ${name}`,
          dueAt:       new Date(Date.now() + 2 * 60 * 60 * 1000),
          priority:    "HIGH",
          leadId:      lead.id,
          description: "Send follow-up if no response to first call",
        },
        {
          title:       `🔁 24h follow-up — ${name}`,
          dueAt:       new Date(Date.now() + 24 * 60 * 60 * 1000),
          priority:    "MEDIUM",
          leadId:      lead.id,
          description: "24-hour follow-up if no response",
        },
      ],
    });

    // Notify admins in CRM
    try {
      const admins = await prisma.user.findMany({ where: { role: "ADMIN", isActive: true } });
      await Promise.all(admins.map(admin =>
        prisma.notification.create({
          data: {
            userId:  admin.id,
            type:    "LEAD_ASSIGNED",
            title:   `🔔 New Lead via n8n — ${name}`,
            message: `${name} (${phone}) from ${source}. Score: ${aiScore.score}. Req: ${requirements}`,
            leadId:  lead.id,
          },
        })
      ));
    } catch {}

    return NextResponse.json({
      status:  "created",
      leadId:  lead.id,
      aiScore,
      message: `Lead created and WhatsApp sent to ${name}`,
    }, { status: 201 });

  } catch (err: any) {
    console.error("n8n webhook error:", err?.message);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status:   "active",
    webhook:  "City Real Space — n8n Integration",
    endpoint: "/api/webhooks/n8n",
    sources:  Object.keys(SOURCE_MAP),
    fields: {
      required: ["phone"],
      optional: ["name", "email", "requirements", "budget", "source", "locality", "property_type"],
    },
  });
}

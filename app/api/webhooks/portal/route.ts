import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { scoreLeadAI } from "@/lib/openai";
import { sendWhatsApp } from "@/lib/whatsapp";

// Map portal names to LeadSource enum
const PORTAL_SOURCE: Record<string, string> = {
  magicbricks: "MAGICBRICKS",
  housing:     "WEBSITE",   // Housing.com maps to WEBSITE (add HOUSING to schema if needed)
  "99acres":   "ACRES99",
  "99acre":    "ACRES99",
};

// Instant WhatsApp message sent to lead right after inquiry
function portalWelcomeMsg(name: string, portal: string, requirements: string) {
  const portalLabel = portal === "MAGICBRICKS" ? "MagicBricks" : portal === "ACRES99" ? "99acres" : "Housing.com";
  return `Hi ${name}! 👋

Thank you for your inquiry on *${portalLabel}*.

We at *City Real Space, Ahmedabad* have received your requirement:
📋 _${requirements}_

A dedicated broker will call you within *30 minutes*.

Meanwhile, reply with:
1️⃣ Your budget range
2️⃣ Preferred area/locality
3️⃣ Ready to move or under construction?

🏠 *City Real Space* | Ahmedabad's Trusted Real Estate Brokers`;
}

// Follow-up message sent after 2 hours if no response
function followUp1Msg(name: string, requirements: string) {
  return `Hi ${name}! 🏠

This is a follow-up from *City Real Space, Ahmedabad*.

We noticed your inquiry for: _${requirements}_

We have *exclusive properties* matching your requirement that are not listed publicly.

Would you like us to share the details? Reply *YES* or call us directly.

📞 City Real Space | Ahmedabad`;
}

// Follow-up message sent after 24 hours
function followUp2Msg(name: string) {
  return `Hi ${name}! 👋

*City Real Space, Ahmedabad* here.

We have some *new listings* that match your property requirement.

🔑 Special offers available this week only.

Reply *INTERESTED* to get property details & pricing.

🏢 City Real Space | Ahmedabad's #1 Real Estate Brokers`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Normalize fields from different portals
    // MagicBricks, 99acres, Housing all send slightly different field names
    const name         = body.name || body.customer_name || body.lead_name || "Portal Lead";
    const phone        = (body.phone || body.mobile || body.contact_number || "").replace(/\D/g, "").slice(-10);
    const email        = body.email || body.email_id || null;
    const requirements = body.requirements || body.message || body.property_type || body.query || "Property inquiry";
    const budget       = parseFloat(body.budget || body.price_range || "0") || null;
    const locality     = body.locality || body.location || body.area || null;
    const portalRaw    = (body.portal || body.source || body.platform || "magicbricks").toLowerCase();
    const source       = PORTAL_SOURCE[portalRaw] || "MAGICBRICKS";
    const propertyType = body.property_type || body.propertyType || null;

    if (!phone) {
      return NextResponse.json({ error: "Phone number required" }, { status: 400 });
    }

    // Duplicate check
    const existing = await prisma.lead.findFirst({
      where: { phone, isDuplicate: false },
    });

    if (existing) {
      // Log the duplicate inquiry as activity
      await prisma.activity.create({
        data: {
          type:        "PORTAL_INQUIRY",
          description: `Duplicate inquiry from ${source}: ${requirements}`,
          leadId:      existing.id,
          metadata:    { portal: source, raw: body },
        },
      });
      // Still send a follow-up to re-engage
      try {
        await sendWhatsApp(phone, followUp1Msg(existing.name, requirements));
      } catch {}
      return NextResponse.json({ status: "duplicate", leadId: existing.id });
    }

    // AI Score
    let aiScore = { score: 60, probability: 0.4, reasoning: "Portal inquiry" };
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
        nextFollowUpAt:  new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours
        utmSource:       portalRaw,
      },
    });

    // Log activity
    await prisma.activity.create({
      data: {
        type:        "PORTAL_INQUIRY",
        description: `New inquiry from ${source}: ${requirements}`,
        leadId:      lead.id,
        metadata:    { portal: source, aiScore, raw: body },
      },
    });

    // Instant WhatsApp to lead
    try {
      await sendWhatsApp(phone, portalWelcomeMsg(name, source, requirements));
    } catch (e) {
      console.error("WhatsApp send failed:", e);
    }

    // Schedule follow-ups in DB as tasks
    await prisma.task.createMany({
      data: [
        {
          title:       `Follow-up 1 — ${name} (${source})`,
          description: `Send WhatsApp follow-up. Requirements: ${requirements}`,
          dueAt:       new Date(Date.now() + 2  * 60 * 60 * 1000), // 2 hours
          priority:    "HIGH",
          leadId:      lead.id,
        },
        {
          title:       `Follow-up 2 — ${name} (${source})`,
          description: `24-hour follow-up if no response`,
          dueAt:       new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
          priority:    "MEDIUM",
          leadId:      lead.id,
        },
        {
          title:       `Follow-up 3 — ${name} (${source})`,
          description: `72-hour final follow-up`,
          dueAt:       new Date(Date.now() + 72 * 60 * 60 * 1000), // 72 hours
          priority:    "LOW",
          leadId:      lead.id,
        },
      ],
    });

    return NextResponse.json({ status: "created", leadId: lead.id, aiScore }, { status: 201 });
  } catch (err) {
    console.error("Portal webhook error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// GET — test endpoint to verify webhook is live
export async function GET() {
  return NextResponse.json({
    status: "active",
    webhook: "City Real Space Portal Webhook",
    portals: ["MagicBricks", "Housing.com", "99acres"],
    endpoint: "/api/webhooks/portal",
  });
}

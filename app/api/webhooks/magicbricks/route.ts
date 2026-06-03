import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { scoreLeadAI } from "@/lib/openai";
import { sendWhatsApp } from "@/lib/whatsapp";

function welcomeMsg(name: string, requirements: string) {
  return `Hi ${name}! 👋

Thank you for your inquiry on *MagicBricks*.

We at *City Real Space, Ahmedabad* have received your requirement:
📋 _${requirements}_

A dedicated broker will call you within *30 minutes*.

Meanwhile, reply with:
1️⃣ Your budget range
2️⃣ Preferred area/locality
3️⃣ Ready to move or under construction?

🏠 *City Real Space* | Ahmedabad's Trusted Real Estate Brokers`;
}

// MagicBricks pushes lead via POST with body matching IPRO PMS format:
// { name, mobile, email, msg, tranType, vdate, city, project, locality }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const name         = body.name?.trim() || "MagicBricks Lead";
    const phone        = (body.mobile || "").replace(/\D/g, "").slice(-10);
    const email        = body.email || null;
    const requirements = body.msg || "Property inquiry from MagicBricks";
    const city         = body.city || null;
    const locality     = body.locality || null;
    const project      = body.project || null;
    const tranType     = body.tranType === "r" ? "RENT" : "BUY"; // "b" = buy, "r" = rent

    if (!phone) {
      return NextResponse.json({ status: "error", message: "Phone number required" }, { status: 400 });
    }

    // Duplicate check
    const existing = await prisma.lead.findFirst({ where: { phone, isDuplicate: false } });

    if (existing) {
      await prisma.activity.create({
        data: {
          type:        "PORTAL_INQUIRY",
          description: `Duplicate MagicBricks inquiry: ${requirements}`,
          leadId:      existing.id,
          metadata:    { portal: "MAGICBRICKS", raw: body },
        },
      });
      try { await sendWhatsApp(phone, welcomeMsg(existing.name, requirements)); } catch {}
      return NextResponse.json({ status: "duplicate", leadId: existing.id });
    }

    // AI Score
    let aiScore = { score: 65, probability: 0.45, reasoning: "MagicBricks portal inquiry" };
    try {
      aiScore = await scoreLeadAI({
        budget: null,
        requirements,
        source: "MAGICBRICKS",
        propertyType: null,
        transactionType: tranType,
      });
    } catch {}

    const newLead = await prisma.lead.create({
      data: {
        name,
        phone,
        email,
        source:          "MAGICBRICKS",
        status:          "NEW",
        requirements:    project ? `${requirements} | Project: ${project}` : requirements,
        budget:          null,
        preferredAreas:  [locality, city].filter(Boolean) as string[],
        transactionType: tranType as any,
        score:           aiScore.score,
        dealProbability: aiScore.probability,
        nextFollowUpAt:  new Date(Date.now() + 2 * 60 * 60 * 1000),
        utmSource:       "magicbricks.com",
      },
    });

    await prisma.activity.create({
      data: {
        type:        "PORTAL_INQUIRY",
        description: `New lead from MagicBricks: ${requirements}`,
        leadId:      newLead.id,
        metadata:    { portal: "MAGICBRICKS", aiScore, raw: body },
      },
    });

    try { await sendWhatsApp(phone, welcomeMsg(name, requirements)); } catch (e) {
      console.error("[MagicBricks Webhook] WhatsApp failed:", e);
    }

    await prisma.task.createMany({
      data: [
        {
          title:       `Follow-up 1 — ${name} (MagicBricks)`,
          description: `WhatsApp follow-up. Requirements: ${requirements}`,
          dueAt:       new Date(Date.now() + 2  * 60 * 60 * 1000),
          priority:    "HIGH",
          leadId:      newLead.id,
        },
        {
          title:       `Follow-up 2 — ${name} (MagicBricks)`,
          description: `24-hour follow-up if no response`,
          dueAt:       new Date(Date.now() + 24 * 60 * 60 * 1000),
          priority:    "MEDIUM",
          leadId:      newLead.id,
        },
        {
          title:       `Follow-up 3 — ${name} (MagicBricks)`,
          description: `72-hour final follow-up`,
          dueAt:       new Date(Date.now() + 72 * 60 * 60 * 1000),
          priority:    "LOW",
          leadId:      newLead.id,
        },
      ],
    });

    return NextResponse.json({ status: "success", leadId: newLead.id }, { status: 200 });
  } catch (err) {
    console.error("[MagicBricks Webhook] Error:", err);
    return NextResponse.json({ status: "error", message: "Internal error" }, { status: 500 });
  }
}

// GET — MagicBricks pings to verify endpoint is live
export async function GET() {
  return NextResponse.json({
    status:   "active",
    webhook:  "City Real Space — MagicBricks Integration",
    endpoint: "/api/webhooks/magicbricks",
  });
}

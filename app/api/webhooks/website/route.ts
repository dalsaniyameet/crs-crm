import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { scoreLeadAI } from "@/lib/openai";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const name         = (body.name || "").trim();
    const phone        = (body.phone || body.mobile || "").replace(/\D/g, "").slice(-10);
    const email        = body.email || null;
    const requirements = body.requirements || body.message || "Website inquiry";
    const budget       = body.budget ? parseFloat(body.budget) : null;
    const propertyType = body.propertyType || body.property_type || null;

    if (!name || !phone) {
      return NextResponse.json({ error: "Name and phone required" }, { status: 400 });
    }

    // Duplicate check
    const existing = await prisma.lead.findFirst({ where: { phone, isDuplicate: false } });
    if (existing) {
      return NextResponse.json({ status: "duplicate", message: "Lead already exists", leadId: existing.id });
    }

    // AI Score
    let aiScore = { score: 60, probability: 0.4, reasoning: "" };
    try {
      aiScore = await scoreLeadAI({ budget, requirements, source: "WEBSITE", propertyType, transactionType: body.transactionType || null });
    } catch {}

    const lead = await prisma.lead.create({
      data: {
        name,
        phone,
        email,
        source:          "WEBSITE",
        status:          "NEW",
        requirements,
        budget,
        propertyType:    propertyType as any || null,
        score:           aiScore.score,
        dealProbability: aiScore.probability,
        nextFollowUpAt:  new Date(Date.now() + 2 * 60 * 60 * 1000),
        utmSource:       body.utmSource || "website",
        utmMedium:       body.utmMedium || null,
        utmCampaign:     body.utmCampaign || null,
      },
    });

    await prisma.activity.create({
      data: {
        type:        "LEAD_CREATED",
        description: `New website lead: ${name} — ${requirements}`,
        leadId:      lead.id,
      },
    });

    return NextResponse.json({ status: "success", leadId: lead.id, aiScore }, { status: 201 });
  } catch (err) {
    console.error("Website webhook error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: "active", endpoint: "/api/webhooks/website" });
}

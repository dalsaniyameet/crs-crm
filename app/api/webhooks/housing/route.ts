import { NextRequest, NextResponse } from "next/server";
import { createDecipheriv } from "crypto";
import { prisma } from "@/lib/prisma";
import { scoreLeadAI } from "@/lib/openai";
import { sendWhatsApp } from "@/lib/whatsapp";

const HOUSING_PROFILE_ID = "5148968";
const ENCRYPTION_KEY = "efe5cfb644866539253d416c44392120"; // 32-char hex key

// Decrypt Housing.com AES-256-CBC encrypted payload
function decryptHousingPayload(encryptedData: string): Record<string, any> | null {
  try {
    const key = Buffer.from(ENCRYPTION_KEY, "utf8"); // 32 bytes
    const data = Buffer.from(encryptedData, "base64");
    // Housing sends IV as first 16 bytes, cipher text after
    const iv = data.slice(0, 16);
    const cipherText = data.slice(16);
    const decipher = createDecipheriv("aes-256-cbc", key, iv);
    const decrypted = Buffer.concat([decipher.update(cipherText), decipher.final()]);
    return JSON.parse(decrypted.toString("utf8"));
  } catch {
    return null;
  }
}

function welcomeMsg(name: string, requirements: string) {
  return `Hi ${name}! 👋

Thank you for your inquiry on *Housing.com*.

We at *City Real Space, Ahmedabad* have received your requirement:
📋 _${requirements}_

A dedicated broker will call you within *30 minutes*.

Meanwhile, reply with:
1️⃣ Your budget range
2️⃣ Preferred area/locality
3️⃣ Ready to move or under construction?

🏠 *City Real Space* | Ahmedabad's Trusted Real Estate Brokers`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Housing sends either encrypted `data` field or plain JSON
    let lead_data: Record<string, any> = body;

    if (body.data && typeof body.data === "string") {
      const decrypted = decryptHousingPayload(body.data);
      if (!decrypted) {
        console.error("[Housing Webhook] Decryption failed");
        return NextResponse.json({ status: "error", message: "Decryption failed" }, { status: 400 });
      }
      lead_data = decrypted;
    }

    // Normalize Housing.com field names
    const name         = lead_data.name || lead_data.sender_name || lead_data.lead_name || "Housing Lead";
    const rawPhone     = lead_data.mobile || lead_data.phone || lead_data.contact || "";
    const phone        = rawPhone.replace(/\D/g, "").slice(-10);
    const email        = lead_data.email || lead_data.email_id || null;
    const requirements = lead_data.message || lead_data.query || lead_data.requirement || lead_data.property_type || "Property inquiry from Housing.com";
    const budget       = parseFloat(lead_data.budget || lead_data.price || "0") || null;
    const locality     = lead_data.locality || lead_data.location || lead_data.city || null;
    const propertyType = lead_data.property_type || lead_data.propertyType || null;

    if (!phone) {
      return NextResponse.json({ status: "error", message: "Phone number required" }, { status: 400 });
    }

    // Duplicate check
    const existing = await prisma.lead.findFirst({ where: { phone, isDuplicate: false } });

    if (existing) {
      await prisma.activity.create({
        data: {
          type:        "PORTAL_INQUIRY",
          description: `Duplicate Housing.com inquiry: ${requirements}`,
          leadId:      existing.id,
          metadata:    { portal: "HOUSING", raw: lead_data },
        },
      });
      try { await sendWhatsApp(phone, welcomeMsg(existing.name, requirements)); } catch {}
      return NextResponse.json({ status: "duplicate", leadId: existing.id });
    }

    // AI Score
    let aiScore = { score: 65, probability: 0.45, reasoning: "Housing.com portal inquiry" };
    try {
      aiScore = await scoreLeadAI({ budget, requirements, source: "HOUSING", propertyType, transactionType: null });
    } catch {}

    // Create lead
    const newLead = await prisma.lead.create({
      data: {
        name,
        phone,
        email,
        source:          "HOUSING",
        status:          "NEW",
        requirements,
        budget,
        preferredAreas:  locality ? [locality] : [],
        propertyType:    propertyType as any || null,
        score:           aiScore.score,
        dealProbability: aiScore.probability,
        nextFollowUpAt:  new Date(Date.now() + 2 * 60 * 60 * 1000),
        utmSource:       "housing.com",
      },
    });

    // Activity log
    await prisma.activity.create({
      data: {
        type:        "PORTAL_INQUIRY",
        description: `New lead from Housing.com: ${requirements}`,
        leadId:      newLead.id,
        metadata:    { portal: "HOUSING", profileId: HOUSING_PROFILE_ID, aiScore, raw: lead_data },
      },
    });

    // Instant WhatsApp
    try { await sendWhatsApp(phone, welcomeMsg(name, requirements)); } catch (e) {
      console.error("[Housing Webhook] WhatsApp failed:", e);
    }

    // Follow-up tasks
    await prisma.task.createMany({
      data: [
        {
          title:       `Follow-up 1 — ${name} (Housing.com)`,
          description: `WhatsApp follow-up. Requirements: ${requirements}`,
          dueAt:       new Date(Date.now() + 2  * 60 * 60 * 1000),
          priority:    "HIGH",
          leadId:      newLead.id,
        },
        {
          title:       `Follow-up 2 — ${name} (Housing.com)`,
          description: `24-hour follow-up if no response`,
          dueAt:       new Date(Date.now() + 24 * 60 * 60 * 1000),
          priority:    "MEDIUM",
          leadId:      newLead.id,
        },
        {
          title:       `Follow-up 3 — ${name} (Housing.com)`,
          description: `72-hour final follow-up`,
          dueAt:       new Date(Date.now() + 72 * 60 * 60 * 1000),
          priority:    "LOW",
          leadId:      newLead.id,
        },
      ],
    });

    return NextResponse.json({ status: "success", leadId: newLead.id }, { status: 200 });
  } catch (err) {
    console.error("[Housing Webhook] Error:", err);
    return NextResponse.json({ status: "error", message: "Internal error" }, { status: 500 });
  }
}

// GET — Housing.com pings this to verify endpoint is live
export async function GET() {
  return NextResponse.json({
    status:    "active",
    webhook:   "City Real Space — Housing.com Integration",
    profileId: HOUSING_PROFILE_ID,
    endpoint:  "/api/webhooks/housing",
  });
}

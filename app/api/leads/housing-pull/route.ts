import { NextRequest, NextResponse } from "next/server";
import { createDecipheriv, createHmac } from "crypto";
import { prisma } from "@/lib/prisma";
import { scoreLeadAI } from "@/lib/openai";
import { sendWhatsApp } from "@/lib/whatsapp";

const PROFILE_ID     = "5148968";
const ENCRYPTION_KEY = "efe5cfb644866539253d416c44392120";

// Housing.com Pull API endpoint
const HOUSING_API_URL = `https://leads.housing.com/api/v2/leads?profile_id=${PROFILE_ID}`;

// Decrypt AES-256-CBC encrypted lead data from Housing
function decrypt(encryptedText: string): any {
  try {
    const key  = Buffer.from(ENCRYPTION_KEY, "utf8"); // 32 bytes
    const data = Buffer.from(encryptedText, "base64");
    const iv   = data.slice(0, 16);
    const cipher = data.slice(16);
    const decipher = createDecipheriv("aes-256-cbc", key, iv);
    const decrypted = Buffer.concat([decipher.update(cipher), decipher.final()]);
    return JSON.parse(decrypted.toString("utf8"));
  } catch {
    return null;
  }
}

// Generate HMAC signature Housing requires for Pull API auth
function generateSignature(timestamp: string): string {
  return createHmac("sha256", ENCRYPTION_KEY)
    .update(`${PROFILE_ID}${timestamp}`)
    .digest("hex");
}

function welcomeMsg(name: string, requirements: string) {
  return `Hi ${name}! 👋

Thank you for your inquiry on *Housing.com*.

We at *City Real Space, Ahmedabad* have received your requirement:
📋 _${requirements}_

A dedicated broker will call you within *30 minutes*.

🏠 *City Real Space* | Ahmedabad's Trusted Real Estate Brokers`;
}

async function processLead(raw: Record<string, any>) {
  const name         = raw.name || raw.sender_name || raw.lead_name || "Housing Lead";
  const phone        = (raw.mobile || raw.phone || raw.contact || "").replace(/\D/g, "").slice(-10);
  const email        = raw.email || null;
  const requirements = raw.message || raw.query || raw.requirement || "Property inquiry from Housing.com";
  const budget       = parseFloat(raw.budget || raw.price || "0") || null;
  const locality     = raw.locality || raw.location || null;
  const propertyType = raw.property_type || null;

  if (!phone) return { status: "skipped", reason: "no phone" };

  // Duplicate check
  const existing = await prisma.lead.findFirst({ where: { phone, isDuplicate: false } });
  if (existing) {
    await prisma.activity.create({
      data: {
        type:        "PORTAL_INQUIRY",
        description: `Duplicate Housing.com pull lead: ${requirements}`,
        leadId:      existing.id,
        metadata:    { portal: "HOUSING", raw },
      },
    });
    return { status: "duplicate", leadId: existing.id };
  }

  // AI Score
  let aiScore = { score: 65, probability: 0.45, reasoning: "Housing.com pull" };
  try {
    aiScore = await scoreLeadAI({ budget, requirements, source: "HOUSING", propertyType, transactionType: null });
  } catch {}

  const lead = await prisma.lead.create({
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

  await prisma.activity.create({
    data: {
      type:        "PORTAL_INQUIRY",
      description: `New lead pulled from Housing.com: ${requirements}`,
      leadId:      lead.id,
      metadata:    { portal: "HOUSING", profileId: PROFILE_ID, aiScore, raw },
    },
  });

  // WhatsApp welcome
  try { await sendWhatsApp(phone, welcomeMsg(name, requirements)); } catch {}

  // Follow-up tasks
  await prisma.task.createMany({
    data: [
      {
        title:    `Follow-up 1 — ${name} (Housing.com)`,
        description: `WhatsApp follow-up. Requirements: ${requirements}`,
        dueAt:    new Date(Date.now() + 2  * 60 * 60 * 1000),
        priority: "HIGH",
        leadId:   lead.id,
      },
      {
        title:    `Follow-up 2 — ${name} (Housing.com)`,
        description: `24-hour follow-up if no response`,
        dueAt:    new Date(Date.now() + 24 * 60 * 60 * 1000),
        priority: "MEDIUM",
        leadId:   lead.id,
      },
      {
        title:    `Follow-up 3 — ${name} (Housing.com)`,
        description: `72-hour final follow-up`,
        dueAt:    new Date(Date.now() + 72 * 60 * 60 * 1000),
        priority: "LOW",
        leadId:   lead.id,
      },
    ],
  });

  return { status: "created", leadId: lead.id };
}

// POST — manually trigger pull from Housing.com API
// GET  — same trigger (for cron jobs / Vercel cron)
async function pullLeads() {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = generateSignature(timestamp);

  const res = await fetch(HOUSING_API_URL, {
    method: "GET",
    headers: {
      "x-profile-id": PROFILE_ID,
      "x-timestamp":  timestamp,
      "x-signature":  signature,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Housing API error ${res.status}: ${text}`);
  }

  const json = await res.json();

  // Housing returns leads array — may be encrypted or plain
  const rawLeads: any[] = json.leads || json.data || (Array.isArray(json) ? json : []);

  const results = [];
  for (const item of rawLeads) {
    // If encrypted, decrypt first
    const lead_data = item.data ? (decrypt(item.data) ?? item) : item;
    const result = await processLead(lead_data);
    results.push(result);
  }

  const created   = results.filter(r => r.status === "created").length;
  const duplicate = results.filter(r => r.status === "duplicate").length;
  const skipped   = results.filter(r => r.status === "skipped").length;

  return { total: rawLeads.length, created, duplicate, skipped };
}

export async function GET(req: NextRequest) {
  // Allow cron secret check for Vercel cron
  const cronSecret = req.headers.get("x-cron-secret");
  if (process.env.CRON_SECRET && cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await pullLeads();
    return NextResponse.json({ status: "success", ...summary });
  } catch (err: any) {
    console.error("[Housing Pull] Error:", err.message);
    return NextResponse.json({ status: "error", message: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const summary = await pullLeads();
    return NextResponse.json({ status: "success", ...summary });
  } catch (err: any) {
    console.error("[Housing Pull] Error:", err.message);
    return NextResponse.json({ status: "error", message: err.message }, { status: 500 });
  }
}

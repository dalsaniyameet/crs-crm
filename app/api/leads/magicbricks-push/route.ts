import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

const MAGICBRICKS_API_URL =
  "https://ipropms.com/api/enquiry/magicbricks/addenquiry";
const MAGICBRICKS_API_KEY = process.env.MAGICBRICKS_API_KEY || "CC274E77-7CB5-4B68";

// POST /api/leads/magicbricks-push
// Body: { leadId: string }
// Pushes a CRM lead to MagicBricks (IPRO PMS) via their POST integration
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { leadId } = await req.json();
    if (!leadId) return NextResponse.json({ error: "leadId required" }, { status: 400 });

    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

    // Map CRM fields → MagicBricks IPRO PMS format
    const payload = {
      name:      lead.name,
      mobile:    lead.phone,
      email:     lead.email || "",
      msg:       lead.requirements || "Property inquiry",
      tranType:  lead.transactionType === "RENT" ? "r" : "b",
      vdate:     new Date().toISOString().slice(0, 10).replace(/-/g, ""), // yyyyMMdd
      city:      lead.preferredAreas?.[1] || lead.preferredAreas?.[0] || "Ahmedabad",
      locality:  lead.preferredAreas?.[0] || "",
      project:   "",
    };

    const res = await fetch(`${MAGICBRICKS_API_URL}?apikey=${MAGICBRICKS_API_KEY}`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(payload),
    });

    const text = await res.text();
    const success = res.ok && text.includes("Lead punched");

    // Log activity on the lead
    await prisma.activity.create({
      data: {
        type:        "PORTAL_INQUIRY",
        description: success
          ? `Lead pushed to MagicBricks successfully`
          : `MagicBricks push failed: ${text}`,
        leadId: lead.id,
        metadata: { portal: "MAGICBRICKS_PUSH", response: text, payload },
      },
    });

    if (!success) {
      return NextResponse.json(
        { error: "Failed to Push Lead", detail: text },
        { status: 502 }
      );
    }

    return NextResponse.json({ status: "success", message: "Lead punched in the CRM" });
  } catch (err: any) {
    console.error("[MagicBricks Push] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

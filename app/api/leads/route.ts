import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { scoreLeadAI } from "@/lib/openai";
import { autoMatchProperties } from "@/lib/autoMatch";
import { runLeadAutomation } from "@/lib/leadAutomation";
import { notifyNewLead } from "@/lib/notify";
import { notifyMatchingOwners } from "@/lib/notifyOwners";

async function getUser(clerkId: string) {
  return prisma.user.findUnique({ where: { clerkId } });
}

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await getUser(userId);
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const { searchParams } = new URL(req.url);
    const status     = searchParams.get("status");
    const source     = searchParams.get("source");
    const assignedTo = searchParams.get("assignedTo");
    const page       = parseInt(searchParams.get("page")  || "1");
    const limit      = parseInt(searchParams.get("limit") || "50");

    const where: Record<string, unknown> = {};
    if (status && status !== "ALL") where.status = status;
    if (source)                      where.source = source;
    if (assignedTo)                  where.assignedToId = assignedTo;

    if (user.role === "BROKER") {
      where.assignedToId = user.id;
    }

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        include: {
          assignedTo: { select: { id: true, name: true, avatar: true } },
          callLogs: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { outcome: true, createdAt: true, notes: true, duration: true },
          },
          tasks: {
            where: { isCompleted: false },
            orderBy: { dueAt: "asc" },
            take: 1,
            select: { title: true, dueAt: true, priority: true },
          },
        },
        orderBy: [{ score: "desc" }, { createdAt: "desc" }],
        skip:  (page - 1) * limit,
        take:  limit,
      }),
      prisma.lead.count({ where }),
    ]);

    return NextResponse.json({ leads, total, page, pages: Math.ceil(total / limit) }, {
      headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" },
    });
  } catch (err: any) {
    console.error("Leads GET error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await getUser(userId);
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const body = await req.json();

    const existing = await prisma.lead.findFirst({
      where: { phone: body.phone, isDuplicate: false },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Duplicate lead detected", existingLead: existing, isDuplicate: true },
        { status: 409 }
      );
    }

    let aiScore = { score: 50, probability: 0.3, reasoning: "" };
    try {
      aiScore = await scoreLeadAI({
        budget:          body.budget,
        requirements:    body.requirements,
        source:          body.source,
        propertyType:    body.propertyType,
        transactionType: body.transactionType,
      });
    } catch {}

    const lead = await prisma.lead.create({
      data: {
        ...body,
        score:           aiScore.score,
        dealProbability: aiScore.probability,
        assignedToId: body.assignedToId || (user.role === "BROKER" ? user.id : undefined),
      },
    });

    await prisma.activity.create({
      data: {
        type:        "LEAD_CREATED",
        description: `New lead created: ${lead.name} (Score: ${aiScore.score})`,
        leadId:      lead.id,
        userId:      user.id,
      },
    });

    autoMatchProperties(lead.id).catch(() => {});
    runLeadAutomation({ leadId: lead.id, newStatus: "NEW", oldStatus: "", triggeredBy: user.id }).catch(() => {});
    if (lead.source === "WHATSAPP") notifyMatchingOwners(lead.id).catch(() => {});

    await notifyNewLead({
      id: lead.id, name: lead.name, phone: lead.phone, email: lead.email,
      source: lead.source, propertyType: lead.propertyType,
      budget: lead.budget, requirements: lead.requirements,
      score: aiScore.score, assignedTo: user.name,
      assignedToId: lead.assignedToId,
    }).catch((e) => console.error("[NOTIFY] lead failed:", e?.message));

    return NextResponse.json({ lead, aiScore }, { status: 201 });
  } catch (err: any) {
    console.error("Leads POST error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

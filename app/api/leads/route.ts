import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { scoreLeadAI } from "@/lib/openai";
import { autoMatchProperties } from "@/lib/autoMatch";
import { runLeadAutomation } from "@/lib/leadAutomation";
import { notifyNewLead } from "@/lib/notify";
import { notifyMatchingOwners } from "@/lib/notifyOwners";

async function getOrCreateUser(clerkId: string) {
  const adminEmails = (process.env.ADMIN_EMAILS || "").split(",").map(e => e.trim().toLowerCase());

  let user = await prisma.user.findUnique({ where: { clerkId } });

  if (user) {
    // Auto-fix role if in ADMIN_EMAILS
    if (adminEmails.includes(user.email.toLowerCase()) && user.role !== "ADMIN") {
      user = await prisma.user.update({ where: { clerkId }, data: { role: "ADMIN" } });
    }
    return user;
  }

  // Fetch from Clerk
  const clerkUser = await fetch(`https://api.clerk.com/v1/users/${clerkId}`, {
    headers: { Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}` },
  }).then(r => r.json()).catch(() => null);

  const email = clerkUser?.email_addresses?.[0]?.email_address ?? "";
  const name  = [clerkUser?.first_name, clerkUser?.last_name].filter(Boolean).join(" ") || "User";
  const role  = adminEmails.includes(email.toLowerCase()) ? "ADMIN" : "BROKER";

  // Check if user exists by email (clerkId mismatch fix)
  const byEmail = email ? await prisma.user.findUnique({ where: { email } }) : null;
  if (byEmail) {
    // Update clerkId and fix role
    user = await prisma.user.update({
      where: { email },
      data:  { clerkId, role: adminEmails.includes(email.toLowerCase()) ? "ADMIN" : byEmail.role },
    });
    return user;
  }

  user = await prisma.user.create({
    data: { clerkId, email, name, role, avatar: clerkUser?.image_url },
  });

  return user;
}

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await getOrCreateUser(userId);
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
    // ADMIN, SALES_MANAGER, MARKETING — see all leads

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

    return NextResponse.json({ leads, total, page, pages: Math.ceil(total / limit) });
  } catch (err: any) {
    console.error("Leads GET error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await getOrCreateUser(userId);
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    if (user.role === "BROKER") {
      return NextResponse.json({ error: "Access denied. Only admin can add leads." }, { status: 403 });
    }

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
    // Notify matching owners for ALL leads (not just WhatsApp source)
    notifyMatchingOwners(lead.id).catch(() => {});

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

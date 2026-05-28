import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { sendAdminEmail, newLeadMessageEmailHtml } from "@/lib/email";

async function getUser(clerkId: string) {
  return prisma.user.findUnique({ where: { clerkId } });
}

// GET /api/leads/call-log?leadId=xxx
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const leadId = new URL(req.url).searchParams.get("leadId");
  if (!leadId) return NextResponse.json([], { status: 200 });

  const logs = await prisma.callLog.findMany({
    where:   { leadId },
    include: { user: { select: { id: true, name: true, avatar: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(logs);
}

// POST /api/leads/call-log
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await getUser(userId);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { leadId, type, duration, notes, outcome, recordingUrl, followUpAt } = await req.json();
  if (!leadId) return NextResponse.json({ error: "leadId required" }, { status: 400 });

  const log = await prisma.callLog.create({
    data: {
      leadId,
      userId:      user.id,
      type:        type        || "OUTGOING",
      duration:    duration    || null,
      notes:       notes       || null,
      outcome:     outcome     || null,
      recordingUrl: recordingUrl || null,
      followUpAt:  followUpAt ? new Date(followUpAt) : null,
    },
    include: { user: { select: { id: true, name: true, avatar: true } } },
  });

  // Log activity on lead
  await prisma.activity.create({
    data: {
      type:        "CALL_LOGGED",
      description: `Call logged — ${outcome || type || "OUTGOING"}${duration ? ` (${Math.floor(duration / 60)}m ${duration % 60}s)` : ""}${notes ? `: ${notes}` : ""}`,
      leadId,
      userId: user.id,
    },
  });

  // Update lead lastContactedAt
  await prisma.lead.update({
    where: { id: leadId },
    data:  {
      lastContactedAt: new Date(),
      status: outcome === "INTERESTED" ? "CONTACTED" : undefined,
      nextFollowUpAt: followUpAt ? new Date(followUpAt) : undefined,
    },
  });

  // If follow-up set, create notification
  if (followUpAt) {
    await prisma.notification.create({
      data: {
        type:    "FOLLOW_UP_DUE",
        title:   "Follow-up Reminder",
        message: `Follow-up due for lead`,
        userId:  user.id,
        leadId,
      },
    });
  }

  // Send email to admin on call log
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { name: true, phone: true } }).catch(() => null);
  if (lead && (notes || outcome)) {
    sendAdminEmail(
      `Call Logged: ${lead.name} - ${outcome || type || "OUTGOING"}`,
      newLeadMessageEmailHtml({
        leadName:  lead.name,
        leadPhone: lead.phone,
        message:   `${outcome || type} ${duration ? `(${Math.floor(duration/60)}m ${duration%60}s)` : ""} ${notes ? `� ${notes}` : ""}`.trim(),
        channel:   "Phone Call",
      })
    ).catch(() => {});
  }

  return NextResponse.json(log, { status: 201 });
}


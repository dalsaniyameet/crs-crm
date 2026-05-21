import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendWhatsApp } from "@/lib/whatsapp";
import { generateFollowUpMessage } from "@/lib/openai";

// This route is called by a cron job (Vercel Cron / external cron)
// Set up in vercel.json: { "crons": [{ "path": "/api/leads/follow-up", "schedule": "0 * * * *" }] }
// Or call manually from dashboard

const CRON_SECRET = process.env.CRON_SECRET || "crs-cron-2024";

export async function POST(req: NextRequest) {
  // Secure the endpoint
  const secret = req.headers.get("x-cron-secret") || new URL(req.url).searchParams.get("secret");
  if (secret !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  // Find all overdue follow-up tasks
  const dueTasks = await prisma.task.findMany({
    where: {
      isCompleted: false,
      dueAt:       { lte: now },
      title:       { contains: "Follow-up" },
    },
    include: {
      lead: true,
    },
    take: 50, // process max 50 at a time
  });

  const results = { sent: 0, failed: 0, skipped: 0 };

  for (const task of dueTasks) {
    if (!task.lead || !task.lead.phone) {
      results.skipped++;
      continue;
    }

    // Skip if lead is already closed/lost
    if (["DEAL_CLOSED", "LOST"].includes(task.lead.status)) {
      await prisma.task.update({ where: { id: task.id }, data: { isCompleted: true } });
      results.skipped++;
      continue;
    }

    try {
      // Generate AI follow-up message
      const message = await generateFollowUpMessage({
        name:            task.lead.name,
        requirements:    task.lead.requirements,
        lastContactedAt: task.lead.lastContactedAt,
        status:          task.lead.status,
      });

      await sendWhatsApp(task.lead.phone, message);

      // Mark task complete + log activity
      await Promise.all([
        prisma.task.update({
          where: { id: task.id },
          data:  { isCompleted: true, completedAt: now },
        }),
        prisma.activity.create({
          data: {
            type:        "FOLLOW_UP_SENT",
            description: `Auto follow-up WhatsApp sent to ${task.lead.name}`,
            leadId:      task.lead.id,
            metadata:    { taskId: task.id, message },
          },
        }),
        prisma.lead.update({
          where: { id: task.lead.id },
          data:  { lastContactedAt: now },
        }),
      ]);

      results.sent++;
    } catch (err) {
      console.error(`Follow-up failed for ${task.lead.name}:`, err);
      results.failed++;
    }
  }

  return NextResponse.json({
    success: true,
    processed: dueTasks.length,
    ...results,
    timestamp: now.toISOString(),
  });
}

// GET — check pending follow-ups count (for dashboard)
export async function GET(req: NextRequest) {
  const { userId } = await import("@clerk/nextjs").then(m => ({ userId: m.auth().userId }));

  const now = new Date();
  const [overdue, upcoming] = await Promise.all([
    prisma.task.count({
      where: { isCompleted: false, dueAt: { lte: now }, title: { contains: "Follow-up" } },
    }),
    prisma.task.count({
      where: { isCompleted: false, dueAt: { gt: now, lte: new Date(Date.now() + 24 * 60 * 60 * 1000) }, title: { contains: "Follow-up" } },
    }),
  ]);

  return NextResponse.json({ overdue, upcoming });
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

async function getUser(clerkId: string) {
  return prisma.user.findUnique({ where: { clerkId } });
}

// GET /api/leads/tasks?leadId=xxx
export async function GET(req: NextRequest) {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const leadId = new URL(req.url).searchParams.get("leadId");
  if (!leadId) return NextResponse.json([], { status: 200 });

  const tasks = await prisma.task.findMany({
    where:   { leadId },
    include: { assignedTo: { select: { id: true, name: true, avatar: true } } },
    orderBy: { dueAt: "asc" },
  });

  return NextResponse.json(tasks);
}

// POST /api/leads/tasks
export async function POST(req: NextRequest) {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await getUser(userId);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { leadId, title, description, dueAt, priority } = await req.json();
  if (!leadId || !title || !dueAt)
    return NextResponse.json({ error: "leadId, title, dueAt required" }, { status: 400 });

  const task = await prisma.task.create({
    data: {
      leadId,
      title,
      description:  description || null,
      dueAt:        new Date(dueAt),
      priority:     priority || "MEDIUM",
      assignedToId: user.id,
    },
    include: { assignedTo: { select: { id: true, name: true, avatar: true } } },
  });

  // Update lead nextFollowUpAt if this task is earlier
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (lead && (!lead.nextFollowUpAt || new Date(dueAt) < lead.nextFollowUpAt)) {
    await prisma.lead.update({ where: { id: leadId }, data: { nextFollowUpAt: new Date(dueAt) } });
  }

  await prisma.activity.create({
    data: {
      type:        "FOLLOW_UP_SCHEDULED",
      description: `Follow-up scheduled: "${title}" on ${new Date(dueAt).toLocaleDateString("en-IN")}`,
      leadId,
      userId:      user.id,
    },
  });

  return NextResponse.json(task, { status: 201 });
}

// PATCH /api/leads/tasks â€” mark complete / update
export async function PATCH(req: NextRequest) {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, isCompleted, title, dueAt, priority, description } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const data: any = {};
  if (isCompleted !== undefined) {
    data.isCompleted = isCompleted;
    if (isCompleted) data.completedAt = new Date();
  }
  if (title !== undefined)       data.title       = title;
  if (dueAt !== undefined)       data.dueAt       = new Date(dueAt);
  if (priority !== undefined)    data.priority    = priority;
  if (description !== undefined) data.description = description;

  const task = await prisma.task.update({ where: { id }, data });
  return NextResponse.json(task);
}

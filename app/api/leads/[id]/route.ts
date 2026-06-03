import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

async function getUser(clerkId: string) {
  return prisma.user.findUnique({ where: { clerkId } });
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await getUser(userId);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const leadId = params.id;

  try {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        assignedTo: { select: { id: true, name: true, avatar: true } },
        callLogs: {
          orderBy: { createdAt: "desc" },
          take: 5,
          include: { user: { select: { name: true } } },
        },
        tasks: {
          where: { isCompleted: false },
          orderBy: { dueAt: "asc" },
          include: { assignedTo: { select: { id: true, name: true } } },
        },
        activities: {
          orderBy: { createdAt: "desc" },
          take: 10,
          select: { id: true, description: true, createdAt: true, type: true },
        },
        matchedProperties: {
          orderBy: { score: "desc" },
          take: 5,
          include: {
            property: {
              select: {
                id: true, title: true, type: true,
                locality: true, price: true, status: true,
              },
            },
          },
        },
      },
    });

    if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

    // Non-admin: only see assigned leads
    if (user.role !== "ADMIN" && lead.assignedToId !== user.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    return NextResponse.json(lead);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
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

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await getUser(userId);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const leadId = params.id;
  const body = await req.json();

  // Non-admin: can only update notes & status on their assigned lead
  if (user.role !== "ADMIN") {
    const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { assignedToId: true } });
    if (!lead || lead.assignedToId !== user.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    // Employee can only update status and notes — not reassign
    const allowedFields = ["status", "notes", "nextFollowUpAt", "lastContactedAt"];
    const patchData: any = {};
    for (const f of allowedFields) {
      if (body[f] !== undefined) patchData[f] = body[f];
    }
    const updated = await prisma.lead.update({
      where: { id: leadId },
      data: {
        ...patchData,
        ...(patchData.nextFollowUpAt && { nextFollowUpAt: new Date(patchData.nextFollowUpAt) }),
      },
      include: { assignedTo: { select: { id: true, name: true, avatar: true } } },
    });
    return NextResponse.json(updated);
  }

  // Admin: full update
  try {
    const updated = await prisma.lead.update({
      where: { id: leadId },
      data: {
        ...(body.status         !== undefined && { status: body.status }),
        ...(body.assignedToId   !== undefined && { assignedToId: body.assignedToId }),
        ...(body.nextFollowUpAt !== undefined && { nextFollowUpAt: body.nextFollowUpAt ? new Date(body.nextFollowUpAt) : null }),
        ...(body.notes          !== undefined && { notes: body.notes }),
        ...(body.score          !== undefined && { score: body.score }),
      },
      include: { assignedTo: { select: { id: true, name: true, avatar: true } } },
    });
    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await getUser(userId);
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Only admin can delete leads" }, { status: 403 });
  }

  try {
    await prisma.lead.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Lead not found or delete failed" }, { status: 404 });
  }
}

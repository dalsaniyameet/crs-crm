import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const campaigns = await prisma.campaign.findMany({
      include: { createdBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(campaigns);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const campaign = await prisma.campaign.create({
      data: {
        name:        body.name,
        type:        body.type,
        content:     body.content,
        subject:     body.subject     || undefined,
        mediaUrl:    body.mediaUrl    || undefined,
        scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : undefined,
        status:      body.scheduledAt ? "SCHEDULED" : "DRAFT",
      },
    });
    return NextResponse.json(campaign, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

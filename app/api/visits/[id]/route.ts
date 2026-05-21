import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body  = await req.json();
    const visit = await prisma.siteVisit.update({
      where: { id: params.id },
      data:  body,
      include: {
        lead:     { select: { id: true, name: true, phone: true } },
        property: { select: { id: true, title: true, locality: true } },
        broker:   { select: { id: true, name: true } },
      },
    });
    return NextResponse.json(visit);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await prisma.siteVisit.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body       = await req.json();
    const commission = await prisma.commission.update({
      where: { id: params.id },
      data:  body,
      include: {
        deal:   { select: { id: true, title: true, value: true } },
        broker: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json(commission);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const campaign = await prisma.campaign.update({
      where: { id: params.id },
      data: {
        ...(body.status === "SENT" ? { sentAt: new Date(), status: "SENT" } : { status: body.status }),
      },
    });
    return NextResponse.json(campaign);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

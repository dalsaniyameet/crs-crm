import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendWhatsApp } from "@/lib/whatsapp";

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const messages = await prisma.ownerMessage.findMany({
      where: { ownerId: params.id },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json(messages);
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { message, direction = "OUT", mediaUrl } = await req.json();
    if (!message) return NextResponse.json({ error: "message required" }, { status: 400 });

    // If outgoing, send via WATI
    if (direction === "OUT") {
      const owner = await prisma.propertyOwner.findUnique({
        where:  { id: params.id },
        select: { phone: true },
      });
      if (owner?.phone) {
        await sendWhatsApp(owner.phone, message, mediaUrl || undefined);
      }
    }

    const msg = await prisma.ownerMessage.create({
      data: { ownerId: params.id, direction, message, mediaUrl: mediaUrl || null },
    });
    return NextResponse.json(msg, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

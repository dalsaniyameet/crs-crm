import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET — fetch inbox messages (with optional filter by wpNumberId)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const wpNumberId = searchParams.get("wpNumberId");
    const unreadOnly = searchParams.get("unread") === "true";

    const messages = await prisma.wpInbox.findMany({
      where: {
        ...(wpNumberId ? { wpNumberId } : {}),
        ...(unreadOnly ? { isRead: false } : {}),
      },
      include: { wpNumber: { select: { label: true, number: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    return NextResponse.json(messages);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH — mark message as read
export async function PATCH(req: NextRequest) {
  try {
    const { id } = await req.json();
    await prisma.wpInbox.update({ where: { id }, data: { isRead: true } });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

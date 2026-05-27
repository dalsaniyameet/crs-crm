import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

// GET /api/chat/rooms/[roomId]/messages
export async function GET(_req: NextRequest, { params }: { params: { roomId: string } }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const me = await prisma.user.findUnique({ where: { clerkId: userId } });
  if (!me) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Verify user is member of this room
  const member = await prisma.chatMember.findFirst({
    where: { roomId: params.roomId, userId: me.id },
  });
  if (!member) return NextResponse.json({ error: "Not a member" }, { status: 403 });

  const messages = await prisma.chatMessage.findMany({
    where:   { roomId: params.roomId },
    include: { sender: { select: { id: true, name: true, avatar: true } } },
    orderBy: { createdAt: "asc" },
    take:    100,
  });

  // Update lastRead
  await prisma.chatMember.update({
    where: { id: member.id },
    data:  { lastRead: new Date() },
  }).catch(() => {});

  return NextResponse.json(messages);
}

// POST /api/chat/rooms/[roomId]/messages
export async function POST(req: NextRequest, { params }: { params: { roomId: string } }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const me = await prisma.user.findUnique({ where: { clerkId: userId } });
  if (!me) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const member = await prisma.chatMember.findFirst({
    where: { roomId: params.roomId, userId: me.id },
  });
  if (!member) return NextResponse.json({ error: "Not a member" }, { status: 403 });

  const { text, fileUrl, fileName, fileType } = await req.json();
  if (!text?.trim() && !fileUrl) {
    return NextResponse.json({ error: "text or fileUrl required" }, { status: 400 });
  }

  const message = await prisma.chatMessage.create({
    data: {
      roomId:   params.roomId,
      senderId: me.id,
      text:     text?.trim() || null,
      fileUrl:  fileUrl || null,
      fileName: fileName || null,
      fileType: fileType || null,
    },
    include: { sender: { select: { id: true, name: true, avatar: true } } },
  });

  // Notify other members
  const otherMembers = await prisma.chatMember.findMany({
    where: { roomId: params.roomId, userId: { not: me.id } },
    select: { userId: true },
  });

  const preview = text?.trim()
    ? (text.length > 80 ? text.slice(0, 80) + "..." : text)
    : `📎 ${fileName || "file"}`;

  await Promise.all(
    otherMembers.map(m =>
      prisma.notification.create({
        data: {
          userId:  m.userId,
          type:    "SYSTEM",
          title:   `Message from ${me.name}`,
          message: preview,
          isRead:  false,
        },
      }).catch(() => {})
    )
  );

  return NextResponse.json(message, { status: 201 });
}

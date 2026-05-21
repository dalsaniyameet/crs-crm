import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

async function getMe(clerkId: string) {
  return prisma.user.findUnique({ where: { clerkId } });
}

// GET /api/chat/rooms/[roomId]/messages
export async function GET(_req: NextRequest, { params }: { params: { roomId: string } }) {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const me = await getMe(userId);
  if (!me) return NextResponse.json([], { status: 200 });

  // Verify membership
  const member = await prisma.chatMember.findUnique({
    where: { roomId_userId: { roomId: params.roomId, userId: me.id } },
  });
  if (!member) return NextResponse.json({ error: "Access denied" }, { status: 403 });

  const messages = await prisma.chatMessage.findMany({
    where:   { roomId: params.roomId },
    include: { sender: { select: { id: true, name: true, avatar: true } } },
    orderBy: { createdAt: "asc" },
    take:    100,
  });

  // Update lastRead
  await prisma.chatMember.update({
    where: { roomId_userId: { roomId: params.roomId, userId: me.id } },
    data:  { lastRead: new Date() },
  });

  return NextResponse.json(messages);
}

// POST /api/chat/rooms/[roomId]/messages
export async function POST(req: NextRequest, { params }: { params: { roomId: string } }) {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const me = await getMe(userId);
  if (!me) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const member = await prisma.chatMember.findUnique({
    where: { roomId_userId: { roomId: params.roomId, userId: me.id } },
  });
  if (!member) return NextResponse.json({ error: "Access denied" }, { status: 403 });

  const body = await req.json();
  const { text, fileUrl, fileName, fileType } = body;

  if (!text && !fileUrl) return NextResponse.json({ error: "Message or file required" }, { status: 400 });

  const message = await prisma.chatMessage.create({
    data: {
      roomId:   params.roomId,
      senderId: me.id,
      text:     text || null,
      fileUrl:  fileUrl || null,
      fileName: fileName || null,
      fileType: fileType || null,
    },
    include: { sender: { select: { id: true, name: true, avatar: true } } },
  });

  // Notify other members
  const others = await prisma.chatMember.findMany({
    where: { roomId: params.roomId, userId: { not: me.id } },
  });

  await Promise.all(others.map(o =>
    prisma.notification.create({
      data: {
        type:    "SYSTEM",
        title:   `💬 New message from ${me.name}`,
        message: text ? (text.length > 60 ? text.slice(0, 60) + "…" : text) : `📎 Sent a file: ${fileName}`,
        userId:  o.userId,
      },
    })
  ));

  return NextResponse.json(message, { status: 201 });
}

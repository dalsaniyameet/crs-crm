import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

async function getMe(clerkId: string) {
  return prisma.user.findUnique({ where: { clerkId } });
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const me = await getMe(userId);
  if (!me) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const memberships = await prisma.chatMember.findMany({
    where: { userId: me.id },
    include: {
      room: {
        include: {
          members: { include: { user: { select: { id: true, name: true, avatar: true, role: true } } } },
          messages: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      },
    },
  });

  const rooms = await Promise.all(memberships.map(async m => {
    const other   = m.room.members.find(mb => mb.userId !== me.id)?.user;
    const lastMsg = m.room.messages[0];

    // Unread = messages after my lastRead sent by others
    const unread = await prisma.chatMessage.count({
      where: {
        roomId:    m.room.id,
        senderId:  { not: me.id },
        isRead:    false,
        createdAt: { gt: m.lastRead },
      },
    });

    return {
      id:       m.room.id,
      name:     m.room.name || other?.name || "Unknown",
      avatar:   other?.avatar,
      role:     other?.role,
      otherId:  other?.id,
      lastMsg:  lastMsg?.text || (lastMsg?.fileName ? `📎 ${lastMsg.fileName}` : null),
      lastTime: lastMsg?.createdAt,
      lastMsgSenderId: lastMsg?.senderId,
      unread,
    };
  }));

  // Sort by lastTime desc
  rooms.sort((a, b) => {
    if (!a.lastTime) return 1;
    if (!b.lastTime) return -1;
    return new Date(b.lastTime).getTime() - new Date(a.lastTime).getTime();
  });

  return NextResponse.json(rooms);
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const me = await getMe(userId);
  if (!me) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { targetUserId } = await req.json();
  if (!targetUserId) return NextResponse.json({ error: "targetUserId required" }, { status: 400 });

  const existing = await prisma.chatRoom.findFirst({
    where: {
      isGroup: false,
      AND: [
        { members: { some: { userId: me.id } } },
        { members: { some: { userId: targetUserId } } },
      ],
    },
  });

  if (existing) return NextResponse.json(existing);

  const room = await prisma.chatRoom.create({
    data: {
      isGroup: false,
      members: { create: [{ userId: me.id }, { userId: targetUserId }] },
    },
  });

  return NextResponse.json(room);
}

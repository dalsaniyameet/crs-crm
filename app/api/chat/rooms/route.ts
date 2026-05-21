import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

async function getMe(clerkId: string) {
  return prisma.user.findUnique({ where: { clerkId } });
}

// GET /api/chat/rooms — list all rooms with last message + unread count
export async function GET() {
  const { userId } = auth();
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
    orderBy: { lastRead: "desc" },
  });

  const rooms = memberships.map(m => {
    const other = m.room.members.find(mb => mb.userId !== me.id)?.user;
    const lastMsg = m.room.messages[0];
    const unread = 0; // simplified
    return {
      id:        m.room.id,
      name:      m.room.name || other?.name || "Unknown",
      avatar:    other?.avatar,
      role:      other?.role,
      otherId:   other?.id,
      lastMsg:   lastMsg?.text || (lastMsg?.fileName ? `📎 ${lastMsg.fileName}` : null),
      lastTime:  lastMsg?.createdAt,
      unread,
    };
  });

  return NextResponse.json(rooms);
}

// POST /api/chat/rooms — get or create DM room with another user
export async function POST(req: NextRequest) {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const me = await getMe(userId);
  if (!me) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { targetUserId } = await req.json();

  // Check if DM room already exists between these two users
  const existing = await prisma.chatRoom.findFirst({
    where: {
      isGroup: false,
      members: { every: { userId: { in: [me.id, targetUserId] } } },
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
      members: {
        create: [{ userId: me.id }, { userId: targetUserId }],
      },
    },
  });

  return NextResponse.json(room);
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const me = await prisma.user.findUnique({ where: { clerkId: userId } });
  if (!me) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (me.role !== "ADMIN" && me.role !== "SALES_MANAGER") {
    return NextResponse.json({ error: "Only admin can broadcast" }, { status: 403 });
  }

  const { text, files } = await req.json();
  // files = [{ url, name, type }]

  if (!text?.trim() && (!files || files.length === 0)) {
    return NextResponse.json({ error: "Message or files required" }, { status: 400 });
  }

  // Get all active employees (exclude sender)
  const employees = await prisma.user.findMany({
    where: { isActive: true, id: { not: me.id } },
    select: { id: true, name: true },
  });

  if (employees.length === 0) {
    return NextResponse.json({ error: "No employees found" }, { status: 400 });
  }

  // For each employee: get or create DM room, then send message(s)
  const results = await Promise.all(
    employees.map(async (emp) => {
      try {
        // Find or create DM room
        let room = await prisma.chatRoom.findFirst({
          where: {
            isGroup: false,
            AND: [
              { members: { some: { userId: me.id } } },
              { members: { some: { userId: emp.id } } },
            ],
          },
        });

        if (!room) {
          room = await prisma.chatRoom.create({
            data: {
              isGroup: false,
              members: { create: [{ userId: me.id }, { userId: emp.id }] },
            },
          });
        }

        const msgs = [];

        // Send text message
        if (text?.trim()) {
          const msg = await prisma.chatMessage.create({
            data: { roomId: room.id, senderId: me.id, text: text.trim() },
          });
          msgs.push(msg);
        }

        // Send each file as separate message
        if (files?.length) {
          for (const f of files) {
            const msg = await prisma.chatMessage.create({
              data: {
                roomId:   room.id,
                senderId: me.id,
                fileUrl:  f.url,
                fileName: f.name,
                fileType: f.type,
              },
            });
            msgs.push(msg);
          }
        }

        // Notify employee
        const preview = text?.trim()
          ? (text.length > 60 ? text.slice(0, 60) + "â€¦" : text)
          : `ðŸ“Ž ${files.length} file${files.length > 1 ? "s" : ""} shared`;

        await prisma.notification.create({
          data: {
            type:    "SYSTEM",
            title:   `ðŸ“¢ Broadcast from ${me.name}`,
            message: preview,
            userId:  emp.id,
          },
        });

        return { empId: emp.id, sent: msgs.length };
      } catch {
        return { empId: emp.id, sent: 0 };
      }
    })
  );

  const totalSent = results.reduce((s, r) => s + r.sent, 0);
  return NextResponse.json({ success: true, employees: employees.length, totalSent });
}

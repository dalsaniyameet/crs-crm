import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";

const DEFAULT_PREFS = {
  leadAssigned:    true,
  followUpDue:     true,
  siteVisit:       true,
  dealUpdate:      true,
  whatsapp:        false,
  dailySummary:    true,
};

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ notifications: [], unreadCount: 0 });

    const user = await prisma.user.findUnique({ where: { clerkId: userId }, select: { id: true, notifPrefs: true } });
    if (!user) return NextResponse.json({ notifications: [], unreadCount: 0 });

    const notifications = await prisma.notification.findMany({
      where:   { userId: user.id },
      orderBy: { createdAt: "desc" },
      take:    20,
    });

    const prefs = (user.notifPrefs as Record<string, boolean>) || DEFAULT_PREFS;

    return NextResponse.json({
      notifications,
      unreadCount: notifications.filter(n => !n.isRead).length,
      prefs: { ...DEFAULT_PREFS, ...prefs },
    });
  } catch {
    return NextResponse.json({ notifications: [], unreadCount: 0, prefs: DEFAULT_PREFS });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ success: true });

    const user = await prisma.user.findUnique({ where: { clerkId: userId }, select: { id: true } });
    if (!user) return NextResponse.json({ success: true });

    const body = await req.json().catch(() => ({}));

    // Mark notification(s) read
    if (body?.id) {
      await prisma.notification.update({ where: { id: body.id }, data: { isRead: true } });
    } else if (body?.markAllRead) {
      await prisma.notification.updateMany({ where: { userId: user.id, isRead: false }, data: { isRead: true } });
    } else if (body?.prefs) {
      // Save notification preferences
      await prisma.user.update({ where: { id: user.id }, data: { notifPrefs: body.prefs } });
    } else {
      await prisma.notification.updateMany({ where: { userId: user.id, isRead: false }, data: { isRead: true } });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: true });
  }
}

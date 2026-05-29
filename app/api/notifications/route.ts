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

    let user = await prisma.user.findUnique({ where: { clerkId: userId }, select: { id: true, notifPrefs: true } });

    // Auto-create user if missing (webhook may have been missed)
    if (!user) {
      try {
        const res = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
          headers: { Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}` },
        });
        const cu = await res.json();
        const email = cu?.email_addresses?.[0]?.email_address ?? "";
        const name  = [cu?.first_name, cu?.last_name].filter(Boolean).join(" ") || "User";
        const adminEmails = (process.env.ADMIN_EMAILS || "").split(",").map(e => e.trim().toLowerCase());
        const role  = adminEmails.includes(email.toLowerCase()) ? "ADMIN" : "BROKER";
        const created = await prisma.user.upsert({
          where:  { clerkId: userId },
          update: { email, name, role },
          create: { clerkId: userId, email, name, role, avatar: cu?.image_url },
        });
        user = { id: created.id, notifPrefs: created.notifPrefs };
      } catch { return NextResponse.json({ notifications: [], unreadCount: 0 }); }
    }

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

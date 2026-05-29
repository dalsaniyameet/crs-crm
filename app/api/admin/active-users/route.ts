import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

const ONLINE_MS   = 90_000;       // green dot < 90s
const ACTIVE_MS   = 30 * 60_000;  // show in live < 30 min
const ALL_DAY_MS  = 24 * 60 * 60_000;

// POST — heartbeat from any logged-in user
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ ok: false });

    const body = await req.json().catch(() => ({}));
    const page: string = body.page || "/dashboard";

    // Get current tabs from DB, merge
    const existing = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { openTabs: true },
    });

    let tabs: string[] = existing?.openTabs ?? [];

    if (Array.isArray(body.allTabs) && body.allTabs.length > 0) {
      tabs = [...new Set(body.allTabs as string[])];
    } else {
      if (!tabs.includes(page)) tabs = [...tabs, page];
      if (body.closedTab) tabs = tabs.filter(t => t !== body.closedTab);
    }

    await prisma.user.update({
      where:  { clerkId: userId },
      data:   { lastSeen: new Date(), currentPage: page, openTabs: tabs },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false });
  }
}

// GET — admin fetches live + today's activity
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ live: [], today: [] });

    // Check admin — by DB or ADMIN_EMAILS
    const me = await prisma.user.findUnique({ where: { clerkId: userId }, select: { role: true, email: true } });
    const adminEmails = (process.env.ADMIN_EMAILS || "").split(",").map(e => e.trim().toLowerCase());
    const isAdmin = me?.role === "ADMIN" || adminEmails.includes((me?.email || "").toLowerCase());
    if (!isAdmin) return NextResponse.json({ live: [], today: [] });

    const now      = new Date();
    const ago30    = new Date(now.getTime() - ACTIVE_MS);
    const startDay = new Date(now); startDay.setHours(0, 0, 0, 0);

    const [liveUsers, todayUsers] = await Promise.all([
      // Last 30 min — live panel
      prisma.user.findMany({
        where:  { lastSeen: { gte: ago30 } },
        select: { id: true, clerkId: true, name: true, email: true, role: true, avatar: true, lastSeen: true, currentPage: true, openTabs: true },
        orderBy: { lastSeen: "desc" },
      }),
      // All day — full day activity
      prisma.user.findMany({
        where:  { lastSeen: { gte: startDay } },
        select: { id: true, clerkId: true, name: true, email: true, role: true, avatar: true, lastSeen: true, currentPage: true, openTabs: true },
        orderBy: { lastSeen: "desc" },
      }),
    ]);

    const format = (u: any) => ({
      clerkId:     u.clerkId,
      name:        u.name,
      email:       u.email,
      role:        u.role,
      avatar:      u.avatar || "",
      lastSeen:    u.lastSeen?.getTime() ?? 0,
      currentPage: u.currentPage || "/dashboard",
      tabs:        u.openTabs ?? [],
      isOnline:    u.lastSeen ? (now.getTime() - u.lastSeen.getTime()) < ONLINE_MS : false,
      minsAgo:     u.lastSeen ? Math.floor((now.getTime() - u.lastSeen.getTime()) / 60000) : 999,
    });

    return NextResponse.json({
      live:  liveUsers.map(format),
      today: todayUsers.map(format),
    });
  } catch (err: any) {
    console.error("active-users GET:", err.message);
    return NextResponse.json({ live: [], today: [] });
  }
}

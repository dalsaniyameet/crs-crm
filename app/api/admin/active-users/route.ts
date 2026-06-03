import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

const ONLINE_MS  = 90_000;        // green dot < 90s
const ACTIVE_MS  = 10 * 60_000;  // show in live < 10 min

// POST — heartbeat from any logged-in user (every 30s)
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ ok: false });

    const body = await req.json().catch(() => ({}));
    const page: string = body.page || "/dashboard";
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

    const existing = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { openTabs: true, lastSeen: true, loginCount: true, loginHistory: true },
    });

    let tabs: string[] = existing?.openTabs ?? [];
    if (Array.isArray(body.allTabs) && body.allTabs.length > 0) {
      tabs = [...new Set(body.allTabs as string[])];
    } else {
      if (!tabs.includes(page)) tabs = [...tabs, page];
      if (body.closedTab) tabs = tabs.filter(t => t !== body.closedTab);
    }

    const now = new Date();

    // Count as new login if lastSeen > 10 min ago (or never seen)
    const isNewLogin = !existing?.lastSeen ||
      (now.getTime() - existing.lastSeen.getTime()) > ACTIVE_MS;

    const loginHistory: any[] = Array.isArray(existing?.loginHistory)
      ? existing.loginHistory as any[]
      : [];

    if (isNewLogin) {
      loginHistory.unshift({ at: now.toISOString(), ip, page });
      if (loginHistory.length > 20) loginHistory.pop(); // keep last 20
    }

    await prisma.user.update({
      where: { clerkId: userId },
      data: {
        lastSeen:     now,
        currentPage:  page,
        openTabs:     tabs,
        loginCount:   isNewLogin ? { increment: 1 } : undefined,
        loginHistory: loginHistory,
      },
    });

    return NextResponse.json({ ok: true, isNewLogin });
  } catch {
    return NextResponse.json({ ok: false });
  }
}

// GET — admin fetches live + today's activity
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ live: [], today: [] });

    const me = await prisma.user.findUnique({ where: { clerkId: userId }, select: { role: true, email: true } });
    const adminEmails = (process.env.ADMIN_EMAILS || "").split(",").map(e => e.trim().toLowerCase());
    const isAdmin = me?.role === "ADMIN" || adminEmails.includes((me?.email || "").toLowerCase());
    if (!isAdmin) return NextResponse.json({ live: [], today: [] });

    const now      = new Date();
    const ago10    = new Date(now.getTime() - ACTIVE_MS);
    const startDay = new Date(now); startDay.setHours(0, 0, 0, 0);

    const [liveUsers, todayUsers] = await Promise.all([
      prisma.user.findMany({
        where:   { lastSeen: { gte: ago10 } },
        select:  { id: true, clerkId: true, name: true, email: true, role: true, avatar: true, lastSeen: true, currentPage: true, openTabs: true, loginCount: true, loginHistory: true, liveLatitude: true, liveLongitude: true, liveAddress: true, liveUpdatedAt: true },
        orderBy: { lastSeen: "desc" },
      }),
      prisma.user.findMany({
        where:   { lastSeen: { gte: startDay } },
        select:  { id: true, clerkId: true, name: true, email: true, role: true, avatar: true, lastSeen: true, currentPage: true, openTabs: true, loginCount: true, loginHistory: true, liveLatitude: true, liveLongitude: true, liveAddress: true, liveUpdatedAt: true },
        orderBy: { lastSeen: "desc" },
      }),
    ]);

    const format = (u: any) => {
      const history: any[] = Array.isArray(u.loginHistory) ? u.loginHistory : [];
      const todayLogins = history.filter((h: any) =>
        new Date(h.at).toDateString() === now.toDateString()
      );
      return {
        clerkId:      u.clerkId,
        name:         u.name,
        email:        u.email,
        role:         u.role,
        avatar:       u.avatar || "",
        lastSeen:     u.lastSeen?.getTime() ?? 0,
        currentPage:  u.currentPage || "/dashboard",
        tabs:         u.openTabs ?? [],
        isOnline:     u.lastSeen ? (now.getTime() - u.lastSeen.getTime()) < ONLINE_MS : false,
        minsAgo:      u.lastSeen ? Math.floor((now.getTime() - u.lastSeen.getTime()) / 60000) : 999,
        loginCount:   u.loginCount ?? 0,
        todayLogins:  todayLogins.length,
        loginHistory: todayLogins.slice(0, 5),
        location:     u.liveLatitude ? {
          lat:     u.liveLatitude,
          lng:     u.liveLongitude,
          address: u.liveAddress,
          updatedAt: u.liveUpdatedAt?.getTime(),
        } : null,
      };
    };

    return NextResponse.json({
      live:  liveUsers.map(format),
      today: todayUsers.map(format),
    });
  } catch (err: any) {
    console.error("active-users GET:", err.message);
    return NextResponse.json({ live: [], today: [] });
  }
}

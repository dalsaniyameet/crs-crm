import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

const ONLINE_MS  = 90_000;
const ACTIVE_MS  = 30 * 60_000;
const TODAY_MS   = 24 * 60 * 60_000;

// POST — heartbeat from any logged-in user (every 30s)
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ ok: false });

    const body = await req.json().catch(() => ({}));
    const page: string = body.page || "/dashboard";
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const now = new Date();

    const existing = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true, email: true, name: true, role: true, avatar: true, openTabs: true, lastSeen: true, loginCount: true, loginHistory: true },
    });

    // If user doesn't exist — create from Clerk
    if (!existing) {
      try {
        const { clerkClient } = await import("@clerk/nextjs/server");
        const clerk = await clerkClient();
        const cu    = await clerk.users.getUser(userId);
        const email = cu.emailAddresses?.[0]?.emailAddress?.toLowerCase() || "";
        const name  = [cu.firstName, cu.lastName].filter(Boolean).join(" ") || email.split("@")[0] || "User";
        const role  = (cu.publicMetadata?.role as string) || "BROKER";
        // Try find by email too (case-insensitive)
        const byEmail = email ? await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } }) : null;
        if (byEmail && byEmail.clerkId !== userId) {
          // Update existing record with correct clerkId
          await prisma.user.update({
            where: { id: byEmail.id },
            data: { clerkId: userId, lastSeen: now, currentPage: page, isActive: true },
          });
          return NextResponse.json({ ok: true, isNewLogin: true });
        }
        await prisma.user.upsert({
          where:  { clerkId: userId },
          update: { lastSeen: now, currentPage: page, isActive: true, name, avatar: cu.imageUrl || null },
          create: { clerkId: userId, email, name, role, avatar: cu.imageUrl || null, lastSeen: now, currentPage: page, isActive: true },
        });
        return NextResponse.json({ ok: true, isNewLogin: true });
      } catch (e: any) {
        console.error("[heartbeat] create user failed:", e?.message);
        return NextResponse.json({ ok: false, error: "user_create_failed" });
      }
    }

    // Build tabs list
    let tabs: string[] = Array.isArray(existing.openTabs) ? existing.openTabs : [];
    if (Array.isArray(body.allTabs) && body.allTabs.length > 0) {
      tabs = [...new Set(body.allTabs as string[])];
    } else {
      if (!tabs.includes(page)) tabs = [...tabs, page];
      if (body.closedTab) tabs = tabs.filter((t: string) => t !== body.closedTab);
    }

    const isNewLogin = !existing.lastSeen ||
      (now.getTime() - existing.lastSeen.getTime()) > ACTIVE_MS;

    const loginHistory: any[] = Array.isArray(existing.loginHistory) ? [...existing.loginHistory] : [];
    if (isNewLogin) {
      loginHistory.unshift({ at: now.toISOString(), ip, page });
      if (loginHistory.length > 20) loginHistory.pop();
    }

    // Use upsert so it never fails even if record somehow missing
    await prisma.user.upsert({
      where:  { clerkId: userId },
      update: {
        lastSeen:    now,
        currentPage: page,
        openTabs:    tabs,
        loginHistory,
        isActive:    true,
        ...(isNewLogin ? { loginCount: { increment: 1 } } : {}),
      },
      create: {
        clerkId:     userId,
        email:       existing.email?.toLowerCase() || "",
        name:        existing.name  || "User",
        role:        existing.role  || "BROKER",
        avatar:      existing.avatar || null,
        lastSeen:    now,
        currentPage: page,
        openTabs:    tabs,
        loginHistory,
        isActive:    true,
        loginCount:  1,
      },
    });

    return NextResponse.json({ ok: true, isNewLogin });
  } catch (e: any) {
    console.error("[heartbeat] POST error:", e?.message);
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

    // ?debug=1 — return all users in DB for diagnosis
    const isDebug = new URL(req.url).searchParams.get("debug") === "1";
    if (isDebug) {
      const all = await prisma.user.findMany({
        select: { name: true, email: true, role: true, isActive: true, lastSeen: true, currentPage: true, clerkId: true },
        orderBy: { lastSeen: { sort: "desc", nulls: "last" } },
      });
      return NextResponse.json({
        total: all.length,
        now: new Date().toISOString(),
        users: all.map(u => ({
          name: u.name, email: u.email, role: u.role, isActive: u.isActive,
          clerkId: u.clerkId?.slice(0, 15),
          lastSeen: u.lastSeen?.toISOString() || null,
          minsAgo: u.lastSeen ? Math.floor((Date.now() - u.lastSeen.getTime()) / 60000) : null,
          currentPage: u.currentPage,
        })),
      });
    }

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
      debug: {
        now: now.toISOString(),
        ago30: ago10.toISOString(),
        startDay: startDay.toISOString(),
        totalLive: liveUsers.length,
        totalToday: todayUsers.length,
      },
    });
  } catch (err: any) {
    console.error("active-users GET:", err.message);
    return NextResponse.json({ live: [], today: [] });
  }
}

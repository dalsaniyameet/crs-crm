import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

// In-memory store for active users
// Format: { clerkId: { name, email, role, lastSeen, tabs: Set<string>, avatar } }
const activeUsers = new Map<string, {
  name: string; email: string; role: string;
  lastSeen: number; tabs: string[]; avatar: string;
}>();

const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

// POST — heartbeat from client (sends all open tabs)
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ ok: false });

    const body = await req.json().catch(() => ({}));
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { name: true, email: true, role: true },
    });
    if (!user) return NextResponse.json({ ok: false });

    const existing = activeUsers.get(userId);
    const incomingTab: string = body.page || "/dashboard";

    // Merge tabs — keep existing ones that are still "alive" + add new
    let tabs: string[] = existing?.tabs || [];
    if (!tabs.includes(incomingTab)) tabs = [...tabs, incomingTab];

    // If client sends closedTab, remove it
    if (body.closedTab) {
      tabs = tabs.filter(t => t !== body.closedTab);
    }

    // If client sends allTabs array, use that as source of truth
    if (Array.isArray(body.allTabs) && body.allTabs.length > 0) {
      tabs = [...new Set(body.allTabs)];
    }

    activeUsers.set(userId, {
      name:     user.name,
      email:    user.email,
      role:     user.role,
      lastSeen: Date.now(),
      tabs,
      avatar:   body.avatar || existing?.avatar || "",
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false });
  }
}

// GET — admin fetches all active users
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json([]);

    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { role: true },
    });
    if (user?.role !== "ADMIN") return NextResponse.json([]);

    const now = Date.now();
    const result: any[] = [];

    activeUsers.forEach((data, clerkId) => {
      if (now - data.lastSeen < TIMEOUT_MS) {
        result.push({
          clerkId,
          name:     data.name,
          email:    data.email,
          role:     data.role,
          lastSeen: data.lastSeen,
          tabs:     data.tabs,
          avatar:   data.avatar,
          isOnline: now - data.lastSeen < 90_000, // green if < 90s
        });
      } else {
        activeUsers.delete(clerkId);
      }
    });

    return NextResponse.json(result.sort((a, b) => b.lastSeen - a.lastSeen));
  } catch {
    return NextResponse.json([]);
  }
}

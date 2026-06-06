import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

// POST — employee apni location update kare (har 30 sec)
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { latitude, longitude, address } = await req.json();
    if (!latitude || !longitude) return NextResponse.json({ error: "lat/lng required" }, { status: 400 });

    await prisma.user.update({
      where: { clerkId: userId },
      data: {
        liveLatitude:  latitude,
        liveLongitude: longitude,
        liveAddress:   address || null,
        liveUpdatedAt: new Date(),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// GET — admin sab employees ki live location dekhe
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const me = await prisma.user.findUnique({ where: { clerkId: userId }, select: { role: true } });
    if (!me || me.role !== "ADMIN") return NextResponse.json({ error: "Admin only" }, { status: 403 });

    // Last 10 min to 2 hours updated locations
    const since = new Date(Date.now() - 5 * 60 * 1000);
    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        liveLatitude:  { not: null },
        liveLongitude: { not: null },
        liveUpdatedAt: { gte: since },
      },
      select: {
        id: true, name: true, role: true, avatar: true,
        liveLatitude: true, liveLongitude: true,
        liveAddress: true, liveUpdatedAt: true,
        currentPage: true,
      },
    });

    return NextResponse.json(users);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

// POST — employee location update + history save
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { latitude, longitude, address } = await req.json();
    if (!latitude || !longitude) return NextResponse.json({ error: "lat/lng required" }, { status: 400 });

    const user = await prisma.user.findUnique({ where: { clerkId: userId }, select: { id: true, liveLatitude: true, liveLongitude: true } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Only save history if moved >30m (avoid duplicate entries when stationary)
    const prevLat = user.liveLatitude || 0;
    const prevLng = user.liveLongitude || 0;
    const moved   = Math.abs(latitude - prevLat) > 0.0003 || Math.abs(longitude - prevLng) > 0.0003;

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { liveLatitude: latitude, liveLongitude: longitude, liveAddress: address || null, liveUpdatedAt: new Date() },
      }),
      // Always save first ping, then only if moved
      ...(moved || !user.liveLatitude ? [
        prisma.locationHistory.create({
          data: { userId: user.id, latitude, longitude, address: address || null },
        })
      ] : []),
    ]);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// GET — admin: all employees live + optional ?userId=&date= for history
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const me = await prisma.user.findUnique({ where: { clerkId: userId }, select: { role: true } });
    if (!me || me.role !== "ADMIN") return NextResponse.json({ error: "Admin only" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const empId  = searchParams.get("userId");
    const date   = searchParams.get("date"); // YYYY-MM-DD

    // History mode — single employee ka aaj ka ya kisi din ka route
    if (empId) {
      const day   = date ? new Date(date) : new Date();
      const start = new Date(day); start.setHours(0, 0, 0, 0);
      const end   = new Date(day); end.setHours(23, 59, 59, 999);

      const history = await prisma.locationHistory.findMany({
        where: { userId: empId, createdAt: { gte: start, lte: end } },
        orderBy: { createdAt: "asc" },
        select: { id: true, latitude: true, longitude: true, address: true, createdAt: true },
      });
      return NextResponse.json(history);
    }

    // Default — all employees live status
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: {
        id: true, name: true, role: true, avatar: true,
        liveLatitude: true, liveLongitude: true,
        liveAddress: true, liveUpdatedAt: true,
        currentPage: true,
      },
      orderBy: { liveUpdatedAt: { sort: "desc", nulls: "last" } },
    });

    return NextResponse.json(users);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

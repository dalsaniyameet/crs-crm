import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs";
import { prisma } from "@/lib/prisma";

// Employee scans location QR → attendance marked for that employee
export async function POST(req: Request) {
  try {
    const { userId } = auth();
    if (!userId) return NextResponse.json({ error: "Please login first" }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const { qrData, latitude, longitude } = await req.json();

    // Parse location QR
    let parsed: any;
    try { parsed = JSON.parse(qrData); } catch {
      return NextResponse.json({ error: "Invalid QR code" }, { status: 400 });
    }

    if (parsed.type !== "CRS_LOCATION") {
      return NextResponse.json({ error: "Not a valid office location QR" }, { status: 400 });
    }

    const location = await prisma.attendanceLocation.findUnique({ where: { id: parsed.locationId } });
    if (!location || !location.isActive) {
      return NextResponse.json({ error: "Location not found or inactive" }, { status: 400 });
    }

    // GPS distance check
    if (latitude && longitude) {
      const dist = getDistance(latitude, longitude, location.latitude, location.longitude);
      if (dist > location.radius) {
        return NextResponse.json(
          { error: `You are ${Math.round(dist)}m away from ${location.name}. Must be within ${location.radius}m` },
          { status: 400 }
        );
      }
    }

    // Time window check (IST)
    const timeCheck = checkTimeWindow();
    if (!timeCheck.allowed) {
      return NextResponse.json({ error: timeCheck.error }, { status: 400 });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existing = await prisma.attendance.findFirst({
      where: { userId: user.id, createdAt: { gte: today }, punchOut: null },
    });

    if (existing) {
      // Punch OUT
      const punchOut  = new Date();
      const workHours = (punchOut.getTime() - existing.punchIn.getTime()) / (1000 * 60 * 60);
      const updated   = await prisma.attendance.update({
        where:   { id: existing.id },
        data:    { punchOut, workHours },
        include: { location: true },
      });
      return NextResponse.json({ type: "OUT", attendance: updated, employeeName: user.name });
    } else {
      // Punch IN
      const attendance = await prisma.attendance.create({
        data:    { userId: user.id, locationId: location.id, punchIn: new Date() },
        include: { location: true },
      });
      return NextResponse.json({ type: "IN", attendance, employeeName: user.name });
    }
  } catch (error: any) {
    console.error("Scan error:", error?.message);
    return NextResponse.json({ error: "Failed to process attendance" }, { status: 500 });
  }
}

function getISTDate() {
  return new Date(Date.now() + 5.5 * 60 * 60 * 1000);
}

function checkTimeWindow(): { allowed: boolean; error?: string } {
  const ist     = getISTDate();
  const day     = ist.getUTCDay();
  const current = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  const sched   = day === 0
    ? { inH: 16, inM: 0, outH: 18, outM: 0 }
    : { inH: 10, inM: 0, outH: 19, outM: 0 };
  const open  = sched.inH * 60 + sched.inM;
  const close = sched.outH * 60 + sched.outM + 60;
  if (current < open)  return { allowed: false, error: `Office opens at ${fmt(sched.inH, sched.inM)}` };
  if (current > close) return { allowed: false, error: `Office closed at ${fmt(sched.outH, sched.outM)}` };
  return { allowed: true };
}

function fmt(h: number, m: number) {
  const ap = h >= 12 ? "PM" : "AM";
  const hh = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${hh}:${String(m).padStart(2, "0")} ${ap}`;
}

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R  = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a  = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { notifyPunchIn, notifyPunchOut } from "@/lib/notify";

// Office hours (IST): Monâ€“Sat 10:00â€“19:00, Sun 16:00â€“18:00
const SCHEDULE = {
  weekday: { inHour: 10, inMin: 0, outHour: 19, outMin: 0 },  // Monâ€“Sat
  sunday:  { inHour: 16, inMin: 0, outHour: 18, outMin: 0 },  // Sun
};

function getISTDate() {
  // Convert current UTC to IST (UTC+5:30)
  const now = new Date();
  const ist = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
  return ist;
}

function checkTimeWindow(type: "IN" | "OUT"): { allowed: boolean; error?: string } {
  const ist     = getISTDate();
  const day     = ist.getUTCDay(); // 0=Sun
  const hour    = ist.getUTCHours();
  const min     = ist.getUTCMinutes();
  const current = hour * 60 + min;
  const sched   = day === 0 ? SCHEDULE.sunday : SCHEDULE.weekday;

  if (type === "IN") {
    const open  = sched.inHour  * 60 + sched.inMin;
    const close = sched.outHour * 60 + sched.outMin;
    if (current < open)
      return { allowed: false, error: `Punch In opens at ${formatTime(sched.inHour, sched.inMin)}` };
    if (current > close)
      return { allowed: false, error: `Punch In closed after ${formatTime(sched.outHour, sched.outMin)}` };
  } else {
    const earliest = sched.inHour  * 60 + sched.inMin;
    const latest   = sched.outHour * 60 + sched.outMin + 60; // 1hr grace after closing
    if (current < earliest)
      return { allowed: false, error: `Punch Out not allowed before ${formatTime(sched.inHour, sched.inMin)}` };
    if (current > latest)
      return { allowed: false, error: `Punch Out window closed` };
  }
  return { allowed: true };
}

function formatTime(h: number, m: number) {
  const ampm = h >= 12 ? "PM" : "AM";
  const hh   = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${hh}:${String(m).padStart(2, "0")} ${ampm}`;
}

export async function GET(req: Request) {
  try {
    const { userId } = auth();
    if (!userId) return NextResponse.json([]);

    const url = new URL((req as any).url || "", "http://localhost");
    const employeeId = url.searchParams.get("employeeId");

    // Admin fetching specific employee attendance
    if (employeeId) {
      const clerkUser = await clerkClient.users.getUser(userId);
      const isAdmin = (clerkUser.publicMetadata?.role as string)?.toUpperCase() === "ADMIN";
      if (!isAdmin) return NextResponse.json([]);

      const emp = await prisma.employeeProfile.findUnique({ where: { id: employeeId } });
      if (!emp) return NextResponse.json([]);

      const records = await prisma.guestAttendance.findMany({
        where: { phone: emp.email },
        include: { location: true },
        orderBy: { punchIn: "desc" },
        take: 30,
      });
      return NextResponse.json(records);
    }

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) return NextResponse.json([]);

    const all = url.searchParams.get("all");
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const attendances = await prisma.attendance.findMany({
      where:   all ? { userId: user.id } : { userId: user.id, createdAt: { gte: today } },
      include: { location: true },
      orderBy: { punchIn: "desc" },
      take: all ? 30 : undefined,
    });

    return NextResponse.json(attendances);
  } catch (error: any) {
    console.error("Attendance GET error:", error?.message);
    return NextResponse.json([]);
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const { locationId, latitude, longitude, type } = await req.json();

    const location = await prisma.attendanceLocation.findUnique({ where: { id: locationId } });
    if (!location || !location.isActive) {
      return NextResponse.json({ error: "Invalid location" }, { status: 400 });
    }

    const distance = getDistance(latitude, longitude, location.latitude, location.longitude);
    if (distance > location.radius) {
      return NextResponse.json(
        { error: `You are ${Math.round(distance)}m away. Must be within ${location.radius}m of ${location.name}` },
        { status: 400 }
      );
    }

    // â”€â”€ Time window check â”€â”€
    const timeCheck = checkTimeWindow(type);
    if (!timeCheck.allowed) {
      return NextResponse.json({ error: timeCheck.error }, { status: 400 });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (type === "IN") {
      const existing = await prisma.attendance.findFirst({
        where: { userId: user.id, createdAt: { gte: today }, punchOut: null },
      });
      if (existing) return NextResponse.json({ error: "Already punched in" }, { status: 400 });

      const attendance = await prisma.attendance.create({
        data:    { userId: user.id, locationId, punchIn: new Date() },
        include: { location: true },
      });

      const punchInTime = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
      notifyPunchIn({
        employeeName: user.name,
        location:     location.name,
        time:         punchInTime,
      }).catch(() => {});

      return NextResponse.json(attendance);
    } else {
      const attendance = await prisma.attendance.findFirst({
        where:   { userId: user.id, createdAt: { gte: today }, punchOut: null },
        orderBy: { punchIn: "desc" },
      });
      if (!attendance) return NextResponse.json({ error: "No active punch in found" }, { status: 400 });

      const punchOut  = new Date();
      const workHours = (punchOut.getTime() - attendance.punchIn.getTime()) / (1000 * 60 * 60);

      const updated = await prisma.attendance.update({
        where:   { id: attendance.id },
        data:    { punchOut, workHours },
        include: { location: true },
      });

      const fmt = (d: Date) => d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
      notifyPunchOut({
        employeeName: user.name,
        location:     updated.location.name,
        punchIn:      fmt(attendance.punchIn),
        punchOut:     fmt(punchOut),
        workHours:    workHours.toFixed(2),
      }).catch(() => {});

      return NextResponse.json(updated);
    }
  } catch (error: any) {
    console.error("Attendance POST error:", error?.message);
    return NextResponse.json({ error: "Failed to process attendance" }, { status: 500 });
  }
}

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const dPhi = ((lat2 - lat1) * Math.PI) / 180;
  const dLam = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLam / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendAdminEmail, sendEmployeeEmail, punchInEmailHtml, punchOutEmailHtml, empPunchInEmailHtml, empPunchOutEmailHtml } from "@/lib/email";

const BREAK_MINUTES = 45;

export async function POST(req: Request) {
  try {
    const { name, phone, locationId, action, bypass } = await req.json();
    // action: "IN" | "OUT" | "BREAK_START" | "BREAK_END"

    if (!name?.trim() || !phone?.trim() || !locationId) {
      return NextResponse.json({ error: "Name, phone and location required" }, { status: 400 });
    }

    const location = await prisma.attendanceLocation.findUnique({ where: { id: locationId } });
    if (!location || !location.isActive) {
      return NextResponse.json({ error: "Invalid location" }, { status: 400 });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existing = await prisma.guestAttendance.findFirst({
      where: { phone: phone.trim(), punchOut: null, createdAt: { gte: today } },
    });

    // Check if already punched in+out today (completed attendance)
    const completedToday = await prisma.guestAttendance.findFirst({
      where: { phone: phone.trim(), punchOut: { not: null }, createdAt: { gte: today } },
    });

    // ── PUNCH IN ──
    if (!existing) {
      if (completedToday) {
        return NextResponse.json({ error: "Already attended today. Cannot punch in again." }, { status: 400 });
      }
      if (!bypass) {
        const timeCheck = checkTimeWindow();
        if (!timeCheck.allowed) return NextResponse.json({ error: timeCheck.error }, { status: 400 });
      }

      const record = await prisma.guestAttendance.create({
        data:    { name: name.trim(), phone: phone.trim(), locationId, punchIn: new Date() },
        include: { location: true },
      });

      // Notify all admins — DB notification + email
      try {
        const admins = await prisma.user.findMany({ where: { role: "ADMIN", isActive: true } });
        const ist = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
        const timeStr = ist.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
        await Promise.all(admins.map(admin =>
          prisma.notification.create({
            data: {
              userId:  admin.id,
              type:    "SYSTEM",
              title:   `${name.trim()} Punched In`,
              message: `${name.trim()} punched in at ${timeStr} — ${record.location.name}`,
            },
          })
        ));
        sendAdminEmail(
          `Punch In: ${name.trim()} — ${timeStr}`,
          punchInEmailHtml({ employeeName: name.trim(), location: record.location.name, time: timeStr })
        ).catch(() => {});
        // Send confirmation to employee
        const empEmail = phone.trim().includes("@") ? phone.trim() : null;
        if (empEmail) {
          sendEmployeeEmail(
            empEmail,
            `✅ Punch In Confirmed — ${timeStr}`,
            empPunchInEmailHtml({ name: name.trim(), location: record.location.name, time: timeStr })
          ).catch(() => {});
        }
      } catch { /* non-critical */ }

      return NextResponse.json({ type: "IN", record });
    }

    // ── PUNCH OUT ──
    if (action === "OUT" || !action) {
      const punchOut   = new Date();
      const totalMs    = punchOut.getTime() - existing.punchIn.getTime();
      const breakMs    = BREAK_MINUTES * 60 * 1000;
      const netMs      = totalMs > breakMs ? totalMs - breakMs : totalMs;
      const workHours  = netMs / (1000 * 60 * 60);

      // Late minutes: expected 10:00 AM (Mon-Sat), 4:00 PM (Sun)
      const punchInIST = new Date(existing.punchIn.getTime() + 5.5 * 60 * 60 * 1000);
      const isSun = punchInIST.getUTCDay() === 0;
      const expectedInMin = isSun ? 16 * 60 : 10 * 60;
      const actualInMin = punchInIST.getUTCHours() * 60 + punchInIST.getUTCMinutes();
      const lateMinutes = Math.max(0, actualInMin - expectedInMin);

      // Overtime: worked beyond 9h (Mon-Sat) or 2h (Sun)
      const expectedHours = isSun ? 2 : 9;
      const overtimeHours = Math.max(0, workHours - expectedHours);

      const updated = await prisma.guestAttendance.update({
        where:   { id: existing.id },
        data:    { punchOut, workHours, lateMinutes, overtimeHours },
        include: { location: true },
      });

      // Notify all admins — DB notification + email
      try {
        const admins = await prisma.user.findMany({ where: { role: "ADMIN", isActive: true } });
        const ist = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
        const timeStr = ist.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
        const punchInTime = new Date(existing.punchIn.getTime() + 5.5 * 60 * 60 * 1000)
          .toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
        await Promise.all(admins.map(admin =>
          prisma.notification.create({
            data: {
              userId:  admin.id,
              type:    "SYSTEM",
              title:   `${name.trim()} Punched Out`,
              message: `${name.trim()} punched out at ${timeStr} — ${workHours.toFixed(1)}h worked`,
            },
          })
        ));
        sendAdminEmail(
          `Punch Out: ${name.trim()} — ${workHours.toFixed(2)} hrs`,
          punchOutEmailHtml({
            employeeName: name.trim(),
            location:     updated.location.name,
            punchIn:      punchInTime,
            punchOut:     timeStr,
            workHours:    workHours.toFixed(2),
          })
        ).catch(() => {});
        // Send summary to employee
        const empEmail2 = phone.trim().includes("@") ? phone.trim() : null;
        if (empEmail2) {
          sendEmployeeEmail(
            empEmail2,
            `🔴 Punch Out Summary — ${workHours.toFixed(1)}h worked`,
            empPunchOutEmailHtml({
              name: name.trim(), location: updated.location.name,
              punchIn: punchInTime, punchOut: timeStr,
              workHours: workHours.toFixed(2),
              lateMinutes, overtimeHours,
            })
          ).catch(() => {});
        }
      } catch { /* non-critical */ }

      return NextResponse.json({ type: "OUT", record: updated, breakDeducted: BREAK_MINUTES });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  } catch (error: unknown) {
    console.error("Guest attendance error:", (error as Error)?.message);
    return NextResponse.json({ error: "Failed to process attendance" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");

    // "all" = return all attendance records
    if (date === "all") {
      const records = await prisma.guestAttendance.findMany({
        include: { location: true },
        orderBy: { punchIn: "desc" },
      });
      return NextResponse.json(records);
    }

    // by phone = full history for one person
    const phone = searchParams.get("phone");
    if (phone) {
      const records = await prisma.guestAttendance.findMany({
        where:   { phone },
        include: { location: true },
        orderBy: { punchIn: "desc" },
        take:    30,
      });
      return NextResponse.json(records);
    }

    const from = date ? new Date(date) : new Date();
    from.setHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setHours(23, 59, 59, 999);

    const records = await prisma.guestAttendance.findMany({
      where:   { createdAt: { gte: from, lte: to } },
      include: { location: true },
      orderBy: { punchIn: "desc" },
    });
    return NextResponse.json(records);
  } catch {
    return NextResponse.json([]);
  }
}

export async function PATCH(req: Request) {
  try {
    const { id, approved, approvedBy } = await req.json();
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    const updated = await prisma.guestAttendance.update({
      where: { id },
      data: { approved, approvedAt: approved ? new Date() : null, approvedBy: approvedBy || null },
      include: { location: true },
    });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
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

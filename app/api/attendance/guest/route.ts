import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendAdminEmail, sendEmployeeEmail, punchInEmailHtml, punchOutEmailHtml, empPunchInEmailHtml, empPunchOutEmailHtml } from "@/lib/email";

const BREAK_MINUTES = 0; // No auto deduction — employee tracks break manually

export async function POST(req: Request) {
  try {
    const { name, phone, locationId, action, bypass, faceImage, backdated, punchInTime, punchOutTime, breakSeconds } = await req.json();
    // action: "IN" | "OUT" | "BREAK_START" | "BREAK_END"
    // backdated: true = admin adding past attendance manually

    if (!name?.trim() || !phone?.trim() || !locationId) {
      return NextResponse.json({ error: "Name, phone and location required" }, { status: 400 });
    }

    const location = await prisma.attendanceLocation.findUnique({ where: { id: locationId } });
    if (!location || !location.isActive) {
      return NextResponse.json({ error: "Invalid location" }, { status: 400 });
    }

    // ── BACKDATED ATTENDANCE (admin adding past records) ──
    if (backdated && punchInTime) {
      const pIn  = new Date(punchInTime);
      const pOut = punchOutTime ? new Date(punchOutTime) : null;

      // Check duplicate for that date
      const dayStart = new Date(pIn); dayStart.setHours(0, 0, 0, 0);
      const dayEnd   = new Date(pIn); dayEnd.setHours(23, 59, 59, 999);
      const duplicate = await prisma.guestAttendance.findFirst({
        where: { phone: phone.trim(), punchIn: { gte: dayStart, lte: dayEnd } },
      });
      if (duplicate) {
        return NextResponse.json({ error: "Attendance already exists for this date" }, { status: 400 });
      }

      let workHours: number | undefined;
      let lateMinutes = 0;
      let overtimeHours = 0;
      if (pOut) {
        const isSun = pIn.getDay() === 0;
        const totalMs = pOut.getTime() - pIn.getTime();
        const breakMs = BREAK_MINUTES * 60 * 1000;
        const netMs   = totalMs > breakMs ? totalMs - breakMs : totalMs;
        workHours     = netMs / (1000 * 60 * 60);
        const expectedInMin = isSun ? 11 * 60 : 10 * 60;
        const actualInMin   = pIn.getHours() * 60 + pIn.getMinutes();
        lateMinutes   = Math.max(0, actualInMin - expectedInMin);
        const expectedH = isSun ? 5 : 9;
        overtimeHours = Math.max(0, workHours - expectedH);
      }

      const record = await prisma.guestAttendance.create({
        data: {
          name: name.trim(), phone: phone.trim(), locationId,
          punchIn: pIn,
          punchOut: pOut,
          workHours,
          lateMinutes,
          overtimeHours,
          approved: false, // admin must approve backdated records
          createdAt: pIn,  // set createdAt to the backdated day so date queries work
        },
        include: { location: true },
      });
      return NextResponse.json({ type: "BACKDATED", record });
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

      // Upload face image to Cloudinary if provided
      let faceImageUrl: string | undefined;
      if (faceImage) {
        try {
          const { uploadBase64ToCloudinary } = await import("@/lib/cloudinary");
          faceImageUrl = await uploadBase64ToCloudinary(faceImage, "face-punch");
        } catch { /* non-critical */ }
      }

      const record = await prisma.guestAttendance.create({
        data:    { name: name.trim(), phone: phone.trim(), locationId, punchIn: new Date(), faceImageIn: faceImageUrl },
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
      const punchOut      = new Date();
      const totalMs       = punchOut.getTime() - existing.punchIn.getTime();
      // breakSeconds sent from client (actual break time tracked by employee)
      const breakSecs     = typeof breakSeconds === "number" && breakSeconds > 0 ? breakSeconds : 0;
      const netMs         = Math.max(0, totalMs - breakSecs * 1000);
      const workHours     = netMs / (1000 * 60 * 60);

      // Late minutes: expected 10:00 AM (Mon-Sat), 11:00 AM (Sun)
      const punchInIST = new Date(existing.punchIn.getTime() + 5.5 * 60 * 60 * 1000);
      const isSun = punchInIST.getUTCDay() === 0;
      const expectedInMin = isSun ? 11 * 60 : 10 * 60;
      const actualInMin = punchInIST.getUTCHours() * 60 + punchInIST.getUTCMinutes();
      const lateMinutes = Math.max(0, actualInMin - expectedInMin);

      // Overtime: worked beyond 9h (Mon-Sat) or 5h (Sun, 11-4 = 5h)
      const expectedHours = isSun ? 5 : 9;
      const overtimeHours = Math.max(0, workHours - expectedHours);

      // Upload face image for punch out
      let faceImageOutUrl: string | undefined;
      if (faceImage) {
        try {
          const { uploadBase64ToCloudinary } = await import("@/lib/cloudinary");
          faceImageOutUrl = await uploadBase64ToCloudinary(faceImage, "face-punch");
        } catch { /* non-critical */ }
      }

      const updated = await prisma.guestAttendance.update({
        where:   { id: existing.id },
        data:    { punchOut, workHours, lateMinutes, overtimeHours, ...(faceImageOutUrl ? { faceImageOut: faceImageOutUrl } : {}) },
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

    // by phone = full history for one person (last 30 days)
    const phone = searchParams.get("phone");
    if (phone) {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const records = await prisma.guestAttendance.findMany({
        where:   { phone, punchIn: { gte: thirtyDaysAgo } },
        include: { location: true },
        orderBy: { punchIn: "desc" },
        take:    60,
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
    const { id, approved, approvedBy, rejected, rejectReason } = await req.json();
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    const updated = await prisma.guestAttendance.update({
      where: { id },
      data: {
        approved: rejected ? false : approved,
        approvedAt: (approved && !rejected) ? new Date() : null,
        approvedBy: approvedBy || null,
        // store reject reason in approvedBy field with prefix if rejected
        ...(rejected ? { approvedBy: rejectReason ? `REJECTED: ${rejectReason}` : "REJECTED" } : {}),
      },
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
    ? { inH: 11, inM: 0, outH: 16, outM: 0 }  // Sunday 11:00–16:00
    : { inH: 10, inM: 0, outH: 19, outM: 0 }; // Mon–Sat 10:00–19:00
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

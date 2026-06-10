import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendAdminEmail, sendEmployeeEmail, punchInEmailHtml, punchOutEmailHtml, empPunchInEmailHtml, empPunchOutEmailHtml } from "@/lib/email";

const BREAK_MINUTES = 0;
const OT_START_MIN  = 19 * 60 + 30; // 7:30 PM IST — overtime threshold
const HALF_DAY_MAX  = 4.5;           // <= 4.5h worked = half day

function getISTDate() { return new Date(Date.now() + 5.5 * 60 * 60 * 1000); }

function calcWork(pIn: Date, pOut: Date, breakSecs = 0) {
  const isSun         = new Date(pIn.getTime() + 5.5 * 60 * 60 * 1000).getUTCDay() === 0;
  const netMs         = Math.max(0, pOut.getTime() - pIn.getTime() - breakSecs * 1000);
  const workHours     = netMs / (1000 * 60 * 60);
  const pInIST        = new Date(pIn.getTime() + 5.5 * 60 * 60 * 1000);
  const expectedInMin = isSun ? 11 * 60 : 10 * 60;
  const actualInMin   = pInIST.getUTCHours() * 60 + pInIST.getUTCMinutes();
  const lateMinutes   = Math.max(0, actualInMin - expectedInMin);
  const expectedHours = isSun ? 5 : 9;
  const overtimeHours = Math.max(0, workHours - expectedHours);
  const isHalfDay     = workHours > 0 && workHours <= HALF_DAY_MAX;
  return { workHours, lateMinutes, overtimeHours, isHalfDay };
}

async function notifyAdmins(title: string, message: string) {
  const admins = await prisma.user.findMany({ where: { role: "ADMIN", isActive: true }, select: { id: true } });
  await Promise.all(admins.map(a =>
    prisma.notification.create({ data: { userId: a.id, type: "SYSTEM", title, message } }).catch(() => {})
  ));
}

async function getEmpEmail(name: string, phone: string) {
  const prof = await prisma.employeeProfile.findFirst({
    where: { OR: [{ email: phone }, { name: { contains: name, mode: "insensitive" } }] },
    select: { email: true },
  }).catch(() => null);
  return prof?.email || (phone.includes("@") ? phone : null);
}

export async function POST(req: Request) {
  try {
    const { name, phone, locationId, action, bypass, faceImage, backdated, punchInTime, punchOutTime, breakSeconds } = await req.json();

    if (!name?.trim() || !phone?.trim() || !locationId)
      return NextResponse.json({ error: "Name, phone and location required" }, { status: 400 });

    const location = await prisma.attendanceLocation.findUnique({ where: { id: locationId } });
    if (!location || !location.isActive)
      return NextResponse.json({ error: "Invalid location" }, { status: 400 });

    // ── BACKDATED ATTENDANCE ──
    if (backdated && punchInTime) {
      const pIn  = new Date(punchInTime);
      const pOut = punchOutTime ? new Date(punchOutTime) : null;

      const dayStart = new Date(pIn); dayStart.setHours(0, 0, 0, 0);
      const dayEnd   = new Date(pIn); dayEnd.setHours(23, 59, 59, 999);
      const duplicate = await prisma.guestAttendance.findFirst({
        where: { phone: phone.trim(), punchIn: { gte: dayStart, lte: dayEnd } },
      });
      if (duplicate) return NextResponse.json({ error: "Attendance already exists for this date" }, { status: 400 });

      const calc = pOut ? calcWork(pIn, pOut) : { workHours: undefined, lateMinutes: 0, overtimeHours: 0, isHalfDay: false };
      const record = await prisma.guestAttendance.create({
        data: {
          name: name.trim(), phone: phone.trim(), locationId,
          punchIn: pIn, punchOut: pOut,
          workHours: calc.workHours,
          lateMinutes: calc.lateMinutes,
          overtimeHours: calc.overtimeHours,
          isHalfDay: calc.isHalfDay,
          approved: false,
          createdAt: pIn,
        },
        include: { location: true },
      });
      return NextResponse.json({ type: "BACKDATED", record });
    }

    const today = new Date(); today.setHours(0, 0, 0, 0);

    const existing = await prisma.guestAttendance.findFirst({
      where: { phone: phone.trim(), punchOut: null, otStatus: null, createdAt: { gte: today } },
    });

    // Also check if there's a pending OT approval
    const pendingOT = await prisma.guestAttendance.findFirst({
      where: { phone: phone.trim(), otStatus: "PENDING", createdAt: { gte: today } },
    });

    const completedToday = await prisma.guestAttendance.findFirst({
      where: { phone: phone.trim(), punchOut: { not: null }, createdAt: { gte: today } },
    });

    // ── PUNCH IN ──
    if (!existing && !pendingOT) {
      if (completedToday)
        return NextResponse.json({ error: "Already attended today. Cannot punch in again." }, { status: 400 });
      if (!bypass) {
        const timeCheck = checkTimeWindow();
        if (!timeCheck.allowed) return NextResponse.json({ error: timeCheck.error }, { status: 400 });
      }

      let faceImageUrl: string | undefined;
      if (faceImage) {
        try { const { uploadBase64ToCloudinary } = await import("@/lib/cloudinary"); faceImageUrl = await uploadBase64ToCloudinary(faceImage, "face-punch"); } catch {}
      }

      const record = await prisma.guestAttendance.create({
        data: { name: name.trim(), phone: phone.trim(), locationId, punchIn: new Date(), faceImageIn: faceImageUrl },
        include: { location: true },
      });

      try {
        const ist     = getISTDate();
        const timeStr = ist.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
        await notifyAdmins(`${name.trim()} Punched In`, `${name.trim()} punched in at ${timeStr} — ${record.location.name}`);
        sendAdminEmail(`Punch In: ${name.trim()} — ${timeStr}`, punchInEmailHtml({ employeeName: name.trim(), location: record.location.name, time: timeStr })).catch(() => {});
        const empEmail = await getEmpEmail(name.trim(), phone.trim());
        if (empEmail) sendEmployeeEmail(empEmail, `✅ Punch In Confirmed — ${timeStr}`, empPunchInEmailHtml({ name: name.trim(), location: record.location.name, time: timeStr })).catch(() => {});
      } catch {}

      return NextResponse.json({ type: "IN", record });
    }

    // If employee re-hits while OT pending — return pending status
    if (pendingOT && (action === "OUT" || !action)) {
      return NextResponse.json({ type: "PENDING_OT", record: pendingOT });
    }

    // ── PUNCH OUT ──
    if (existing && (action === "OUT" || !action)) {
      const punchOut  = new Date();
      const istNow    = getISTDate();
      const istMinute = istNow.getUTCHours() * 60 + istNow.getUTCMinutes();

      // ── OVERTIME CHECK: after 7:30 PM needs admin approval ──
      if (istMinute >= OT_START_MIN && !bypass) {
        let faceImageOutUrl: string | undefined;
        if (faceImage) {
          try { const { uploadBase64ToCloudinary } = await import("@/lib/cloudinary"); faceImageOutUrl = await uploadBase64ToCloudinary(faceImage, "face-punch"); } catch {}
        }

        const pending = await prisma.guestAttendance.update({
          where:   { id: existing.id },
          data:    { otPunchOutAt: punchOut, otStatus: "PENDING", ...(faceImageOutUrl ? { faceImageOut: faceImageOutUrl } : {}) },
          include: { location: true },
        });

        // Notify admins with approve/deny info
        const timeStr   = istNow.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
        const APP_URL   = process.env.NEXT_PUBLIC_APP_URL || "https://cityrealspacecrm.com";
        const approveUrl = `${APP_URL}/api/attendance/overtime-punch?id=${existing.id}&action=APPROVE`;
        const denyUrl    = `${APP_URL}/api/attendance/overtime-punch?id=${existing.id}&action=DENY`;
        const punchInStr = new Date(existing.punchIn.getTime() + 5.5 * 60 * 60 * 1000)
          .toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });

        await notifyAdmins(
          `⏰ Overtime Punch Out: ${name.trim()}`,
          `${name.trim()} wants to punch out at ${timeStr} (after 7:30 PM). CRM Attendance page se approve karo.`
        );
        sendAdminEmail(
          `⏰ Overtime Punch Out: ${name.trim()} — ${timeStr}`,
          `<div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;background:#f4f6fb;padding:20px;border-radius:10px">
            <div style="background:#0f172a;padding:16px 24px;border-radius:8px 8px 0 0">
              <div style="color:#f59e0b;font-size:16px;font-weight:bold">⏰ Overtime Punch Out Request</div>
              <div style="color:#94a3b8;font-size:13px">City Real Space CRM</div>
            </div>
            <div style="background:#fff;padding:20px;border-radius:0 0 8px 8px;border:1px solid #e2e8f0">
              <p style="color:#1e293b"><strong>${name.trim()}</strong> wants to punch out at <strong style="color:#f59e0b">${timeStr}</strong> (after 7:30 PM).</p>
              <p style="color:#64748b;font-size:13px">Punch In: ${punchInStr} &nbsp;|&nbsp; Location: ${pending.location.name}</p>
              <div style="margin-top:20px;display:flex;gap:12px">
                <a href="${approveUrl}" style="padding:10px 24px;background:#16a34a;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold">✅ Approve</a>
                <a href="${denyUrl}" style="padding:10px 24px;background:#dc2626;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold">❌ Deny</a>
              </div>
              <p style="color:#94a3b8;font-size:12px;margin-top:12px">Ya CRM → Attendance page par jaake approve karo.</p>
            </div>
          </div>`
        ).catch(() => {});

        return NextResponse.json({ type: "PENDING_OT", record: pending });
      }

      // Normal punch out
      const breakSecs = typeof breakSeconds === "number" && breakSeconds > 0 ? breakSeconds : 0;
      const calc      = calcWork(existing.punchIn, punchOut, breakSecs);

      let faceImageOutUrl: string | undefined;
      if (faceImage) {
        try { const { uploadBase64ToCloudinary } = await import("@/lib/cloudinary"); faceImageOutUrl = await uploadBase64ToCloudinary(faceImage, "face-punch"); } catch {}
      }

      const updated = await prisma.guestAttendance.update({
        where:   { id: existing.id },
        data:    {
          punchOut, workHours: calc.workHours, lateMinutes: calc.lateMinutes,
          overtimeHours: calc.overtimeHours, isHalfDay: calc.isHalfDay,
          ...(faceImageOutUrl ? { faceImageOut: faceImageOutUrl } : {}),
        },
        include: { location: true },
      });

      try {
        const ist        = getISTDate();
        const timeStr    = ist.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
        const punchInStr = new Date(existing.punchIn.getTime() + 5.5 * 60 * 60 * 1000)
          .toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
        const label = calc.isHalfDay ? " (Half Day)" : calc.overtimeHours > 0 ? ` (+${calc.overtimeHours.toFixed(1)}h OT)` : "";
        await notifyAdmins(`${name.trim()} Punched Out`, `${name.trim()} punched out at ${timeStr} — ${calc.workHours.toFixed(1)}h${label}`);
        sendAdminEmail(`Punch Out: ${name.trim()} — ${calc.workHours.toFixed(2)} hrs`, punchOutEmailHtml({ employeeName: name.trim(), location: updated.location.name, punchIn: punchInStr, punchOut: timeStr, workHours: calc.workHours.toFixed(2) })).catch(() => {});
        const empEmail = await getEmpEmail(name.trim(), phone.trim());
        if (empEmail) sendEmployeeEmail(empEmail, `🔴 Punch Out Summary — ${calc.workHours.toFixed(1)}h${calc.isHalfDay ? " (Half Day)" : ""}`, empPunchOutEmailHtml({ name: name.trim(), location: updated.location.name, punchIn: punchInStr, punchOut: timeStr, workHours: calc.workHours.toFixed(2), lateMinutes: calc.lateMinutes, overtimeHours: calc.overtimeHours })).catch(() => {});
      } catch {}

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

    if (date === "all") {
      const records = await prisma.guestAttendance.findMany({ include: { location: true }, orderBy: { punchIn: "desc" } });
      return NextResponse.json(records);
    }

    const phone = searchParams.get("phone");
    const name  = searchParams.get("name");
    if (phone || name) {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const orConditions: any[] = [];
      if (phone) { orConditions.push({ phone }); orConditions.push({ phone: phone.toLowerCase() }); }
      if (name)  orConditions.push({ name: { contains: name, mode: "insensitive" } });
      const records = await prisma.guestAttendance.findMany({
        where: { OR: orConditions, punchIn: { gte: thirtyDaysAgo } },
        include: { location: true }, orderBy: { punchIn: "desc" }, take: 60,
      });
      return NextResponse.json(records);
    }

    const from = date ? new Date(date) : new Date();
    from.setHours(0, 0, 0, 0);
    const to = new Date(from); to.setHours(23, 59, 59, 999);
    const records = await prisma.guestAttendance.findMany({
      where: { createdAt: { gte: from, lte: to } }, include: { location: true }, orderBy: { punchIn: "desc" },
    });
    return NextResponse.json(records);
  } catch { return NextResponse.json([]); }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, approved, approvedBy, rejected, rejectReason, fixPunchOut, fixPunchIn, selfFix } = body;
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    if (fixPunchOut || fixPunchIn) {
      const record = await prisma.guestAttendance.findUnique({ where: { id } });
      if (!record) return NextResponse.json({ error: "Record not found" }, { status: 404 });

      const pIn  = fixPunchIn  ? new Date(fixPunchIn)  : record.punchIn;
      const pOut = fixPunchOut ? new Date(fixPunchOut) : record.punchOut;
      const calc = pIn && pOut ? calcWork(pIn, pOut) : { workHours: record.workHours, lateMinutes: record.lateMinutes ?? 0, overtimeHours: record.overtimeHours ?? 0, isHalfDay: record.isHalfDay ?? false };
      const isSelfFix = selfFix === true;

      const updated = await prisma.guestAttendance.update({
        where: { id },
        data: {
          ...(fixPunchIn  ? { punchIn: pIn }  : {}),
          ...(fixPunchOut ? { punchOut: pOut } : {}),
          workHours: calc.workHours, lateMinutes: calc.lateMinutes,
          overtimeHours: calc.overtimeHours, isHalfDay: calc.isHalfDay,
          approved:   isSelfFix ? false : true,
          approvedBy: isSelfFix ? null  : "Admin Fix",
          approvedAt: isSelfFix ? null  : new Date(),
        },
        include: { location: true },
      });

      try {
        const { sendEmployeeEmail: se } = await import("@/lib/email");
        const empEmail = await getEmpEmail(record.name, record.phone);
        if (empEmail) {
          const dateStr = new Date(pIn).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
          const pInStr  = new Date(pIn).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
          const pOutStr = pOut ? new Date(pOut).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }) : "—";
          se(empEmail, isSelfFix ? `🔧 Fix Request Received — ${dateStr}` : `✅ Attendance Fixed — ${dateStr}`,
            `<p>Hi <strong>${record.name}</strong>, ${isSelfFix ? "your fix request is <strong>pending admin approval</strong>." : "your attendance has been <strong>fixed and approved</strong>."}</p>
             <p>Date: ${dateStr} | In: ${pInStr} | Out: ${pOutStr}${calc.workHours ? ` | Hours: ${(calc.workHours as number).toFixed(1)}h` : ""}</p>`
          ).catch(() => {});
        }
      } catch {}
      return NextResponse.json(updated);
    }

    const updated = await prisma.guestAttendance.update({
      where: { id },
      data: {
        approved:   rejected ? false : approved,
        approvedAt: (approved && !rejected) ? new Date() : null,
        approvedBy: approvedBy || null,
        ...(rejected ? { approvedBy: rejectReason ? `REJECTED: ${rejectReason}` : "REJECTED" } : {}),
      },
      include: { location: true },
    });

    try {
      const { sendEmployeeEmail: se } = await import("@/lib/email");
      const empEmail = await getEmpEmail(updated.name, updated.phone);
      if (empEmail) {
        const dateStr    = new Date(updated.punchIn).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
        const punchInStr = new Date(updated.punchIn).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
        const punchOutStr = updated.punchOut ? new Date(updated.punchOut).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }) : "—";
        if (!rejected && approved)
          se(empEmail, `✅ Attendance Approved — ${dateStr}`, `<p>Hi <strong>${updated.name}</strong>, your attendance for ${dateStr} (${punchInStr} → ${punchOutStr}) has been approved.</p>`).catch(() => {});
        else if (rejected)
          se(empEmail, `❌ Attendance Rejected — ${dateStr}`, `<p>Hi <strong>${updated.name}</strong>, your attendance for ${dateStr} was rejected.${rejectReason ? ` Reason: ${rejectReason}` : ""}</p>`).catch(() => {});
      }
    } catch {}

    return NextResponse.json(updated);
  } catch { return NextResponse.json({ error: "Failed" }, { status: 500 }); }
}

function checkTimeWindow(): { allowed: boolean; error?: string } {
  const ist     = getISTDate();
  const day     = ist.getUTCDay();
  const current = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  const sched   = day === 0
    ? { inH: 11, inM: 0, outH: 16, outM: 0 }
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

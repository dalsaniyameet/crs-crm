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
        // Send confirmation to employee — email by name lookup
        try {
          const empProfile = await prisma.employeeProfile.findFirst({
            where: { name: { contains: name.trim(), mode: "insensitive" } },
            select: { email: true },
          });
          const empEmail = empProfile?.email || (phone.trim().includes("@") ? phone.trim() : null);
          if (empEmail) {
            sendEmployeeEmail(
              empEmail,
              `✅ Punch In Confirmed — ${timeStr}`,
              empPunchInEmailHtml({ name: name.trim(), location: record.location.name, time: timeStr })
            ).catch(() => {});
          }
        } catch {}
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
        // Send summary to employee — email by name lookup
        try {
          const empProfile2 = await prisma.employeeProfile.findFirst({
            where: { name: { contains: name.trim(), mode: "insensitive" } },
            select: { email: true },
          });
          const empEmail2 = empProfile2?.email || (phone.trim().includes("@") ? phone.trim() : null);
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
        } catch {}
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
    const name  = searchParams.get("name");
    if (phone || name) {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const orConditions: any[] = [];
      if (phone) {
        orConditions.push({ phone });
        orConditions.push({ phone: phone.toLowerCase() });
        orConditions.push({ phone: phone.toUpperCase() });
      }
      if (name)  orConditions.push({ name: { contains: name, mode: "insensitive" } });
      const records = await prisma.guestAttendance.findMany({
        where:   { OR: orConditions, punchIn: { gte: thirtyDaysAgo } },
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
    const body = await req.json();
    const { id, approved, approvedBy, rejected, rejectReason, fixPunchOut, fixPunchIn, selfFix } = body;
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    // ── Fix missing punch out (or punch in) for a specific record ──
    if (fixPunchOut || fixPunchIn) {
      const record = await prisma.guestAttendance.findUnique({ where: { id } });
      if (!record) return NextResponse.json({ error: "Record not found" }, { status: 404 });

      const pIn  = fixPunchIn  ? new Date(fixPunchIn)  : record.punchIn;
      const pOut = fixPunchOut ? new Date(fixPunchOut) : record.punchOut;

      let workHours: number | null = record.workHours;
      let lateMinutes = record.lateMinutes ?? 0;
      let overtimeHours = record.overtimeHours ?? 0;

      if (pIn && pOut) {
        const isSun = pIn.getDay() === 0;
        workHours = (pOut.getTime() - pIn.getTime()) / (1000 * 60 * 60);
        const expectedInMin = isSun ? 11 * 60 : 10 * 60;
        const actualInMin   = pIn.getHours() * 60 + pIn.getMinutes();
        lateMinutes   = Math.max(0, actualInMin - expectedInMin);
        const expectedH = isSun ? 5 : 9;
        overtimeHours = Math.max(0, workHours - expectedH);
      }

      // selfFix = employee request, keep pending for admin approval
      // admin fix = auto approve
      const isSelfFix = selfFix === true;

      const updated = await prisma.guestAttendance.update({
        where: { id },
        data: {
          ...(fixPunchIn  ? { punchIn: pIn }   : {}),
          ...(fixPunchOut ? { punchOut: pOut }  : {}),
          workHours,
          lateMinutes,
          overtimeHours,
          approved:   isSelfFix ? false : true,
          approvedBy: isSelfFix ? null  : "Admin Fix",
          approvedAt: isSelfFix ? null  : new Date(),
        },
        include: { location: true },
      });

      // Email employee about fix
      try {
        const { sendEmployeeEmail } = await import("@/lib/email");
        const empProfile = await prisma.employeeProfile.findFirst({
          where: { OR: [{ email: record.phone }, { name: { contains: record.name, mode: "insensitive" } }] },
          select: { email: true },
        });
        const empEmail = empProfile?.email || (record.phone.includes("@") ? record.phone : null);
        if (empEmail) {
          const dateStr = new Date(pIn).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
          const pInStr  = pIn  ? new Date(pIn).toLocaleTimeString("en-IN",  { hour: "2-digit", minute: "2-digit", hour12: true }) : "—";
          const pOutStr = pOut ? new Date(pOut).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }) : "—";
          sendEmployeeEmail(empEmail,
            isSelfFix ? `🔧 Fix Request Received — ${dateStr}` : `✅ Attendance Fixed — ${dateStr}`,
            `<div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;background:#f4f6fb;padding:20px;border-radius:10px">
            <div style="background:#0f172a;padding:16px 24px;border-radius:8px 8px 0 0">
              <div style="color:#f59e0b;font-size:16px;font-weight:bold">${isSelfFix ? "🔧 Fix Request Received" : "✅ Attendance Fixed"}</div>
              <div style="color:#94a3b8;font-size:13px">City Real Space CRM</div>
            </div>
            <div style="background:#fff;padding:20px;border-radius:0 0 8px 8px;border:1px solid #e2e8f0">
              <p style="color:#1e293b;font-size:14px">Hi <strong>${record.name}</strong>, ${isSelfFix ? "your fix request has been received and is <strong>pending admin approval</strong>." : "your attendance has been <strong style='color:#16a34a'>fixed and approved</strong> by admin."}</p>
              <table style="width:100%;border-collapse:collapse">
                <tr><td style="padding:6px 10px;color:#64748b;font-size:13px">Date</td><td style="padding:6px 10px;color:#1e293b;font-size:14px"><strong>${dateStr}</strong></td></tr>
                <tr style="background:#f8fafc"><td style="padding:6px 10px;color:#64748b;font-size:13px">Punch In</td><td style="padding:6px 10px;font-size:14px">${pInStr}</td></tr>
                <tr><td style="padding:6px 10px;color:#64748b;font-size:13px">Punch Out</td><td style="padding:6px 10px;font-size:14px">${pOutStr}</td></tr>
                ${workHours ? `<tr style="background:#f8fafc"><td style="padding:6px 10px;color:#64748b;font-size:13px">Work Hours</td><td style="padding:6px 10px;color:#2563eb;font-size:14px"><strong>${workHours.toFixed(1)}h</strong></td></tr>` : ""}
              </table>
              <div style="margin-top:16px"><a href="${process.env.NEXT_PUBLIC_APP_URL || "https://cityrealspacecrm.com"}/employee" style="padding:10px 22px;background:#f59e0b;color:#0f172a;text-decoration:none;border-radius:6px;font-size:14px;font-weight:bold">View My Attendance →</a></div>
            </div></div>`
          ).catch(() => {});
        }
      } catch { /* non-critical */ }

      return NextResponse.json(updated);
    }

    const updated = await prisma.guestAttendance.update({
      where: { id },
      data: {
        approved: rejected ? false : approved,
        approvedAt: (approved && !rejected) ? new Date() : null,
        approvedBy: approvedBy || null,
        ...(rejected ? { approvedBy: rejectReason ? `REJECTED: ${rejectReason}` : "REJECTED" } : {}),
      },
      include: { location: true },
    });

    // Send email to employee
    try {
      const { sendEmployeeEmail } = await import("@/lib/email");
      const empProfile = await prisma.employeeProfile.findFirst({
        where: { OR: [{ email: updated.phone }, { name: { contains: updated.name, mode: "insensitive" } }] },
        select: { email: true },
      });
      const empEmail = empProfile?.email || (updated.phone.includes("@") ? updated.phone : null);
      if (empEmail) {
        const dateStr = new Date(updated.punchIn).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
        const punchInStr = new Date(updated.punchIn).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
        const punchOutStr = updated.punchOut ? new Date(updated.punchOut).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }) : "—";
        if (!rejected && approved) {
          sendEmployeeEmail(empEmail, `✅ Attendance Approved — ${dateStr}`,
            `<div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;background:#f4f6fb;padding:20px;border-radius:10px">
            <div style="background:#0f172a;padding:16px 24px;border-radius:8px 8px 0 0">
              <div style="color:#f59e0b;font-size:16px;font-weight:bold">✅ Attendance Approved</div>
              <div style="color:#94a3b8;font-size:13px">City Real Space CRM</div>
            </div>
            <div style="background:#fff;padding:20px;border-radius:0 0 8px 8px;border:1px solid #e2e8f0">
              <p style="color:#1e293b;font-size:14px">Hi <strong>${updated.name}</strong>, your attendance has been <strong style="color:#16a34a">approved</strong>.</p>
              <table style="width:100%;border-collapse:collapse">
                <tr><td style="padding:6px 10px;color:#64748b;font-size:13px">Date</td><td style="padding:6px 10px;color:#1e293b;font-size:14px"><strong>${dateStr}</strong></td></tr>
                <tr style="background:#f8fafc"><td style="padding:6px 10px;color:#64748b;font-size:13px">Punch In</td><td style="padding:6px 10px;color:#1e293b;font-size:14px">${punchInStr}</td></tr>
                <tr><td style="padding:6px 10px;color:#64748b;font-size:13px">Punch Out</td><td style="padding:6px 10px;color:#1e293b;font-size:14px">${punchOutStr}</td></tr>
                ${updated.workHours ? `<tr style="background:#f8fafc"><td style="padding:6px 10px;color:#64748b;font-size:13px">Work Hours</td><td style="padding:6px 10px;color:#2563eb;font-size:14px"><strong>${updated.workHours.toFixed(1)}h</strong></td></tr>` : ""}
              </table>
              <div style="margin-top:16px"><a href="${process.env.NEXT_PUBLIC_APP_URL || "https://cityrealspacecrm.com"}/employee" style="padding:10px 22px;background:#16a34a;color:#fff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:bold">View My Attendance →</a></div>
            </div></div>`
          ).catch(() => {});
        } else if (rejected) {
          sendEmployeeEmail(empEmail, `❌ Attendance Rejected — ${dateStr}`,
            `<div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;background:#f4f6fb;padding:20px;border-radius:10px">
            <div style="background:#0f172a;padding:16px 24px;border-radius:8px 8px 0 0">
              <div style="color:#ef4444;font-size:16px;font-weight:bold">❌ Attendance Rejected</div>
              <div style="color:#94a3b8;font-size:13px">City Real Space CRM</div>
            </div>
            <div style="background:#fff;padding:20px;border-radius:0 0 8px 8px;border:1px solid #e2e8f0">
              <p style="color:#1e293b;font-size:14px">Hi <strong>${updated.name}</strong>, your attendance for <strong>${dateStr}</strong> has been <strong style="color:#dc2626">rejected</strong>.</p>
              ${rejectReason ? `<p style="color:#64748b;font-size:13px">Reason: <em>${rejectReason}</em></p>` : ""}
              <div style="margin-top:16px"><a href="${process.env.NEXT_PUBLIC_APP_URL || "https://cityrealspacecrm.com"}/employee" style="padding:10px 22px;background:#dc2626;color:#fff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:bold">View My Attendance →</a></div>
            </div></div>`
          ).catch(() => {});
        }
      }
    } catch { /* non-critical */ }

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

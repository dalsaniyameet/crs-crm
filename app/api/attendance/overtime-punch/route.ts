import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://cityrealspacecrm.com";

// GET — admin clicks approve/deny link from email
export async function GET(req: NextRequest) {
  const id     = req.nextUrl.searchParams.get("id");
  const action = req.nextUrl.searchParams.get("action"); // APPROVE | DENY
  if (!id || !action) return NextResponse.json({ error: "id and action required" }, { status: 400 });

  const record = await prisma.guestAttendance.findUnique({ where: { id }, include: { location: true } });
  if (!record || record.otStatus !== "PENDING") {
    return html(record?.otStatus === "APPROVED" ? "✅ Already Approved" : record?.otStatus === "DENIED" ? "❌ Already Denied" : "❌ Request not found", "");
  }

  if (action === "APPROVE") {
    const pOut  = record.otPunchOutAt!;
    const netMs = Math.max(0, pOut.getTime() - record.punchIn.getTime());
    const workHours = netMs / (1000 * 60 * 60);
    const pInIST    = new Date(record.punchIn.getTime() + 5.5 * 60 * 60 * 1000);
    const isSun     = pInIST.getUTCDay() === 0;
    const lateMinutes  = Math.max(0, pInIST.getUTCHours() * 60 + pInIST.getUTCMinutes() - (isSun ? 11 * 60 : 10 * 60));
    const overtimeHours = Math.max(0, workHours - (isSun ? 5 : 9));
    const isHalfDay     = workHours > 0 && workHours <= 4.5;

    await prisma.guestAttendance.update({
      where: { id },
      data: {
        punchOut: pOut, workHours, lateMinutes, overtimeHours, isHalfDay,
        otStatus: "APPROVED", otApprovedAt: new Date(), otApprovedBy: "Admin (Email)",
      },
    });

    // Notify admins
    const admins = await prisma.user.findMany({ where: { role: "ADMIN", isActive: true }, select: { id: true } });
    await Promise.all(admins.map(a => prisma.notification.create({
      data: { userId: a.id, type: "SYSTEM", title: `OT Approved: ${record.name}`, message: `${record.name} overtime punch out approved — ${workHours.toFixed(1)}h worked` },
    }).catch(() => {})));

    // Email employee
    try {
      const { sendEmployeeEmail } = await import("@/lib/email");
      const prof = await prisma.employeeProfile.findFirst({
        where: { OR: [{ email: record.phone }, { name: { contains: record.name, mode: "insensitive" } }] },
        select: { email: true },
      });
      const empEmail = prof?.email || (record.phone.includes("@") ? record.phone : null);
      if (empEmail) {
        const timeStr = new Date(pOut.getTime() + 5.5 * 60 * 60 * 1000).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
        sendEmployeeEmail(empEmail, `✅ Overtime Punch Out Approved — ${timeStr}`,
          `<p>Hi <strong>${record.name}</strong>, your overtime punch out at <strong>${timeStr}</strong> has been approved by admin.</p>
           <p>Total work hours: <strong>${workHours.toFixed(1)}h</strong>${overtimeHours > 0 ? ` (${overtimeHours.toFixed(1)}h overtime)` : ""}</p>`
        ).catch(() => {});
      }
    } catch {}

    return html("✅ Overtime Approved!", `${record.name} punched out — ${workHours.toFixed(1)}h worked`);
  }

  // DENY
  await prisma.guestAttendance.update({
    where: { id },
    data: { otStatus: "DENIED", otApprovedAt: new Date(), otApprovedBy: "Admin (Email)" },
  });

  try {
    const { sendEmployeeEmail } = await import("@/lib/email");
    const prof = await prisma.employeeProfile.findFirst({
      where: { OR: [{ email: record.phone }, { name: { contains: record.name, mode: "insensitive" } }] },
      select: { email: true },
    });
    const empEmail = prof?.email || (record.phone.includes("@") ? record.phone : null);
    if (empEmail) sendEmployeeEmail(empEmail, "❌ Overtime Punch Out Denied",
      `<p>Hi <strong>${record.name}</strong>, your overtime punch out request has been denied by admin. Please contact your manager.</p>`
    ).catch(() => {});
  } catch {}

  return html("❌ Overtime Denied", `${record.name}'s overtime punch out request has been denied.`);
}

// POST — admin approves/denies from CRM UI
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await prisma.user.findUnique({ where: { clerkId: userId }, select: { role: true, name: true } });
  if (dbUser?.role?.toUpperCase() !== "ADMIN") return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const { id, action } = await req.json();
  if (!id || !action) return NextResponse.json({ error: "id and action required" }, { status: 400 });

  const record = await prisma.guestAttendance.findUnique({ where: { id } });
  if (!record || record.otStatus !== "PENDING") return NextResponse.json({ error: "Not found or already processed" }, { status: 400 });

  if (action === "APPROVE") {
    const pOut  = record.otPunchOutAt!;
    const netMs = Math.max(0, pOut.getTime() - record.punchIn.getTime());
    const workHours = netMs / (1000 * 60 * 60);
    const pInIST    = new Date(record.punchIn.getTime() + 5.5 * 60 * 60 * 1000);
    const isSun     = pInIST.getUTCDay() === 0;
    const lateMinutes   = Math.max(0, pInIST.getUTCHours() * 60 + pInIST.getUTCMinutes() - (isSun ? 11 * 60 : 10 * 60));
    const overtimeHours = Math.max(0, workHours - (isSun ? 5 : 9));
    const isHalfDay     = workHours > 0 && workHours <= 4.5;

    const updated = await prisma.guestAttendance.update({
      where: { id },
      data: {
        punchOut: pOut, workHours, lateMinutes, overtimeHours, isHalfDay,
        otStatus: "APPROVED", otApprovedAt: new Date(), otApprovedBy: dbUser.name || "Admin",
      },
    });

    try {
      const { sendEmployeeEmail } = await import("@/lib/email");
      const prof = await prisma.employeeProfile.findFirst({
        where: { OR: [{ email: record.phone }, { name: { contains: record.name, mode: "insensitive" } }] },
        select: { email: true },
      });
      const empEmail = prof?.email || (record.phone.includes("@") ? record.phone : null);
      if (empEmail) {
        const timeStr = new Date(pOut.getTime() + 5.5 * 60 * 60 * 1000).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
        sendEmployeeEmail(empEmail, `✅ Overtime Punch Out Approved — ${timeStr}`,
          `<p>Hi <strong>${record.name}</strong>, your overtime punch out at <strong>${timeStr}</strong> has been approved.</p>
           <p>Total: <strong>${workHours.toFixed(1)}h</strong>${overtimeHours > 0 ? ` (${overtimeHours.toFixed(1)}h OT)` : ""}</p>`
        ).catch(() => {});
      }
    } catch {}

    return NextResponse.json({ success: true, record: updated });
  }

  // DENY
  const updated = await prisma.guestAttendance.update({
    where: { id },
    data: { otStatus: "DENIED", otApprovedAt: new Date(), otApprovedBy: dbUser.name || "Admin" },
  });

  try {
    const { sendEmployeeEmail } = await import("@/lib/email");
    const prof = await prisma.employeeProfile.findFirst({
      where: { OR: [{ email: record.phone }, { name: { contains: record.name, mode: "insensitive" } }] },
      select: { email: true },
    });
    const empEmail = prof?.email || (record.phone.includes("@") ? record.phone : null);
    if (empEmail) sendEmployeeEmail(empEmail, "❌ Overtime Punch Out Denied",
      `<p>Hi <strong>${record.name}</strong>, your overtime punch out request was denied. Please contact your manager.</p>`
    ).catch(() => {});
  } catch {}

  return NextResponse.json({ success: true, record: updated });
}

function html(title: string, msg: string) {
  return new Response(
    `<html><body style="font-family:Arial;text-align:center;padding:60px;background:#0f172a;color:#fff">
      <h2>${title}</h2><p style="color:#94a3b8">${msg}</p>
      <a href="${APP_URL}/attendance" style="display:inline-block;margin-top:20px;padding:10px 24px;background:#6366f1;color:#fff;border-radius:6px;text-decoration:none">Go to CRM →</a>
    </body></html>`,
    { headers: { "Content-Type": "text/html" } }
  );
}

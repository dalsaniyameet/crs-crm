import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { sendAdminEmail } from "@/lib/email";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://crs-crm.vercel.app";

export async function GET() {
  const hasEmailPass = !!(process.env.EMAIL_PASS && process.env.EMAIL_PASS !== "YOUR_EMAIL_PASSWORD");
  const hasEmailUser = !!process.env.EMAIL_USER;
  const adminEmails  = process.env.ADMIN_EMAILS || "not set";
  return NextResponse.json({
    emailConfigured: hasEmailPass && hasEmailUser,
    EMAIL_USER:  hasEmailUser ? process.env.EMAIL_USER : "NOT SET",
    EMAIL_HOST:  process.env.EMAIL_HOST || "NOT SET",
    EMAIL_PORT:  process.env.EMAIL_PORT || "NOT SET",
    EMAIL_PASS:  hasEmailPass ? "SET (hidden)" : "NOT SET",
    ADMIN_EMAILS: adminEmails,
  });
}

export async function POST() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const now  = new Date();
    const time = now.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const name = user.name || user.email || "Admin";

    // ── Fetch all CRM data in parallel ──
    const [
      unreadNotifs,
      pendingLeaves,
      pendingAttendance,
      pendingDocs,
      todayLeads,
      todayDeals,
      todayVisits,
      todayPunchIns,
      employees,
    ] = await Promise.all([
      // Unread notifications (last 20)
      prisma.notification.findMany({
        where: { isRead: false },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { user: { select: { name: true } } },
      }),
      // Pending leave requests
      prisma.leaveRequest.findMany({
        where: { status: "PENDING" },
        include: { employee: { select: { name: true, position: true } } },
        orderBy: { createdAt: "desc" },
      }),
      // Pending attendance approvals (punchOut done but not approved)
      prisma.guestAttendance.findMany({
        where: { punchOut: { not: null }, approved: false, approvedBy: null },
        orderBy: { punchIn: "desc" },
        take: 20,
      }),
      // Pending employee documents
      prisma.employeeDocument.findMany({
        where: { status: "PENDING", uploadedBy: "EMPLOYEE" },
        include: { employee: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      }),
      // Today's new leads
      prisma.lead.findMany({
        where: { createdAt: { gte: todayStart } },
        orderBy: { createdAt: "desc" },
        select: { name: true, phone: true, source: true, score: true, status: true },
      }),
      // Today's deals
      prisma.deal.findMany({
        where: { createdAt: { gte: todayStart } },
        orderBy: { createdAt: "desc" },
        select: { title: true, stage: true, value: true },
      }),
      // Today's site visits
      prisma.siteVisit.findMany({
        where: { scheduledAt: { gte: todayStart } },
        include: { lead: { select: { name: true } }, property: { select: { title: true } } },
        orderBy: { scheduledAt: "asc" },
      }),
      // Today's punch-ins
      prisma.guestAttendance.findMany({
        where: { createdAt: { gte: todayStart } },
        orderBy: { punchIn: "desc" },
      }),
      // Active employees
      prisma.employeeProfile.findMany({
        where: { isActive: true },
        select: { name: true, position: true },
      }),
    ]);

    // ── Create in-app notification ──
    await prisma.notification.create({
      data: {
        userId:  user.id,
        type:    "SYSTEM",
        title:   "📊 CRM Daily Digest Sent",
        message: `Full CRM summary emailed at ${time}. ${unreadNotifs.length} pending notifications, ${pendingLeaves.length} leave requests, ${todayLeads.length} new leads today.`,
        isRead:  false,
      },
    });

    // ── Build HTML sections ──
    const sectionHeader = (icon: string, title: string, count: number, color: string) =>
      `<tr><td colspan="2" style="padding:14px 16px 6px;background:${color};border-radius:6px 6px 0 0">
        <span style="font-size:18px">${icon}</span>
        <span style="color:#fff;font-size:15px;font-weight:700;margin-left:8px">${title}</span>
        <span style="float:right;background:rgba(255,255,255,0.2);color:#fff;font-size:12px;padding:2px 10px;border-radius:20px;font-weight:700">${count}</span>
      </td></tr>`;

    const emptyRow = (msg: string) =>
      `<tr><td colspan="2" style="padding:10px 16px;color:#94a3b8;font-size:13px;font-style:italic">${msg}</td></tr>`;

    const dataRow = (label: string, value: string, alt = false) =>
      `<tr style="background:${alt ? "#f8fafc" : "#fff"}">
        <td style="padding:7px 16px;color:#64748b;font-size:13px;width:160px">${label}</td>
        <td style="padding:7px 16px;color:#1e293b;font-size:13px">${value}</td>
      </tr>`;

    // 1. Pending Notifications
    let notifRows = sectionHeader("🔔", "Pending Notifications", unreadNotifs.length, "#7c3aed");
    if (unreadNotifs.length === 0) {
      notifRows += emptyRow("No unread notifications");
    } else {
      unreadNotifs.forEach((n, i) => {
        notifRows += dataRow(
          new Date(n.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: true }),
          `<strong>${n.title}</strong><br><span style="color:#64748b;font-size:12px">${n.message}</span>`,
          i % 2 === 1
        );
      });
    }

    // 2. Pending Leaves
    let leaveRows = sectionHeader("🗓️", "Pending Leave Requests", pendingLeaves.length, "#dc2626");
    if (pendingLeaves.length === 0) {
      leaveRows += emptyRow("No pending leave requests");
    } else {
      pendingLeaves.forEach((l, i) => {
        leaveRows += dataRow(
          l.employee.name,
          `${l.type.replace(/_/g, " ")} · ${l.days} day(s) · ${new Date(l.fromDate).toLocaleDateString("en-IN")} → ${new Date(l.toDate).toLocaleDateString("en-IN")}<br><span style="color:#64748b;font-size:12px">${l.reason}</span>`,
          i % 2 === 1
        );
      });
    }

    // 3. Pending Attendance Approvals
    let attRows = sectionHeader("⏰", "Pending Attendance Approvals", pendingAttendance.length, "#d97706");
    if (pendingAttendance.length === 0) {
      attRows += emptyRow("No pending attendance approvals");
    } else {
      pendingAttendance.forEach((a, i) => {
        const pIn  = new Date(a.punchIn).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: true });
        const pOut = a.punchOut ? new Date(a.punchOut).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }) : "—";
        attRows += dataRow(
          a.name,
          `${pIn} → ${pOut} · <strong>${(a.workHours || 0).toFixed(1)}h</strong>${a.lateMinutes > 0 ? ` · <span style="color:#dc2626">${a.lateMinutes}m late</span>` : ""}`,
          i % 2 === 1
        );
      });
    }

    // 4. Pending Documents
    let docRows = sectionHeader("📄", "Pending Document Approvals", pendingDocs.length, "#0891b2");
    if (pendingDocs.length === 0) {
      docRows += emptyRow("No pending documents");
    } else {
      pendingDocs.forEach((d, i) => {
        docRows += dataRow(d.employee.name, `${d.name} · ${d.type.replace(/_/g, " ")}`, i % 2 === 1);
      });
    }

    // 5. Today's Activity
    const todayPunchedIn  = todayPunchIns.filter(p => !p.punchOut).length;
    const todayPunchedOut = todayPunchIns.filter(p => p.punchOut).length;

    let activityRows = sectionHeader("📊", "Today's CRM Activity", 0, "#16a34a");
    activityRows += dataRow("Date", `<strong>${now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</strong>`);
    activityRows += dataRow("New Leads", `<strong style="color:#d97706">${todayLeads.length}</strong>`, true);
    activityRows += dataRow("New Deals", `<strong style="color:#0891b2">${todayDeals.length}</strong>`);
    activityRows += dataRow("Site Visits Today", `<strong style="color:#7c3aed">${todayVisits.length}</strong>`, true);
    activityRows += dataRow("In Office Now", `<strong style="color:#16a34a">${todayPunchedIn}</strong> of ${employees.length} employees`);
    activityRows += dataRow("Punched Out", `${todayPunchedOut}`, true);

    // Today's leads list
    if (todayLeads.length > 0) {
      activityRows += `<tr><td colspan="2" style="padding:8px 16px;background:#f0fdf4;font-size:12px;font-weight:700;color:#16a34a">Today's New Leads</td></tr>`;
      todayLeads.forEach((l, i) => {
        const heat = l.score >= 80 ? "🔥 HOT" : l.score >= 60 ? "🌡️ WARM" : "❄️ COLD";
        activityRows += dataRow(l.name, `${l.phone} · ${l.source.replace(/_/g, " ")} · ${heat}`, i % 2 === 1);
      });
    }

    // Today's visits
    if (todayVisits.length > 0) {
      activityRows += `<tr><td colspan="2" style="padding:8px 16px;background:#faf5ff;font-size:12px;font-weight:700;color:#7c3aed">Today's Site Visits</td></tr>`;
      todayVisits.forEach((v, i) => {
        activityRows += dataRow(
          v.lead.name,
          `${v.property?.title || "—"} · ${new Date(v.scheduledAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}`,
          i % 2 === 1
        );
      });
    }

    // Today's attendance
    if (todayPunchIns.length > 0) {
      activityRows += `<tr><td colspan="2" style="padding:8px 16px;background:#f0f9ff;font-size:12px;font-weight:700;color:#0891b2">Today's Attendance</td></tr>`;
      todayPunchIns.forEach((p, i) => {
        const pIn  = new Date(p.punchIn).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
        const pOut = p.punchOut ? new Date(p.punchOut).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }) : "In Office";
        activityRows += dataRow(p.name, `${pIn} → ${pOut}${p.workHours ? ` · ${p.workHours.toFixed(1)}h` : ""}`, i % 2 === 1);
      });
    }

    // ── Assemble full email ──
    const totalAlerts = unreadNotifs.length + pendingLeaves.length + pendingAttendance.length + pendingDocs.length;

    const html = `
<div style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto;background:#f1f5f9;padding:20px;border-radius:12px">

  <!-- Header -->
  <div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%);padding:24px 28px;border-radius:10px 10px 0 0;text-align:center">
    <div style="font-size:36px;margin-bottom:8px">🏙️</div>
    <h1 style="color:#f59e0b;font-size:20px;margin:0 0 4px;font-weight:900;letter-spacing:1px">City Real Space CRM</h1>
    <p style="color:#94a3b8;font-size:13px;margin:0">Full CRM Digest · ${time}</p>
    <div style="margin-top:12px;display:inline-block;background:${totalAlerts > 0 ? "#dc2626" : "#16a34a"};color:#fff;font-size:13px;font-weight:700;padding:4px 16px;border-radius:20px">
      ${totalAlerts > 0 ? `⚠️ ${totalAlerts} items need attention` : "✅ All clear"}
    </div>
  </div>

  <!-- Summary Bar -->
  <div style="background:#fff;padding:16px 20px;display:flex;gap:12px;flex-wrap:wrap;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0">
    ${[
      { label: "Unread Notifs",  value: unreadNotifs.length,       color: "#7c3aed" },
      { label: "Pending Leaves", value: pendingLeaves.length,      color: "#dc2626" },
      { label: "Att. Approvals", value: pendingAttendance.length,  color: "#d97706" },
      { label: "Pending Docs",   value: pendingDocs.length,        color: "#0891b2" },
      { label: "New Leads",      value: todayLeads.length,         color: "#16a34a" },
      { label: "In Office",      value: todayPunchedIn,            color: "#059669" },
    ].map(s => `
      <div style="flex:1;min-width:80px;text-align:center;padding:10px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0">
        <div style="font-size:22px;font-weight:900;color:${s.color}">${s.value}</div>
        <div style="font-size:11px;color:#64748b;margin-top:2px">${s.label}</div>
      </div>`).join("")}
  </div>

  <!-- Sections -->
  <div style="background:#fff;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 10px 10px;overflow:hidden">
    <table style="width:100%;border-collapse:collapse">
      ${notifRows}
      <tr><td colspan="2" style="height:12px;background:#f1f5f9"></td></tr>
      ${leaveRows}
      <tr><td colspan="2" style="height:12px;background:#f1f5f9"></td></tr>
      ${attRows}
      <tr><td colspan="2" style="height:12px;background:#f1f5f9"></td></tr>
      ${docRows}
      <tr><td colspan="2" style="height:12px;background:#f1f5f9"></td></tr>
      ${activityRows}
    </table>

    <!-- CTA -->
    <div style="padding:20px;text-align:center;background:#0f172a;border-top:1px solid #1e293b">
      <a href="${APP_URL}/dashboard" style="display:inline-block;padding:11px 28px;background:#f59e0b;color:#0f172a;text-decoration:none;border-radius:8px;font-size:14px;font-weight:900;margin:0 6px">
        Open Dashboard →
      </a>
      <a href="${APP_URL}/attendance" style="display:inline-block;padding:11px 28px;background:#16a34a;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:700;margin:0 6px">
        Attendance →
      </a>
      <a href="${APP_URL}/admin-employees" style="display:inline-block;padding:11px 28px;background:#7c3aed;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:700;margin:0 6px">
        Employees →
      </a>
    </div>
  </div>

  <div style="text-align:center;color:#94a3b8;font-size:11px;margin-top:12px">
    City Real Space CRM · Triggered by ${name} · ${time}<br>
    <a href="${APP_URL}" style="color:#f59e0b">cityrealspace.com</a>
  </div>
</div>`;

    await sendAdminEmail(
      `📊 CRM Digest — ${totalAlerts} pending · ${todayLeads.length} new leads · ${todayPunchedIn} in office`,
      html
    );

    return NextResponse.json({
      success: true,
      message: `Digest sent! ${totalAlerts} pending items, ${todayLeads.length} new leads today.`,
      stats: {
        unreadNotifs:      unreadNotifs.length,
        pendingLeaves:     pendingLeaves.length,
        pendingAttendance: pendingAttendance.length,
        pendingDocs:       pendingDocs.length,
        todayLeads:        todayLeads.length,
        todayVisits:       todayVisits.length,
        inOffice:          todayPunchedIn,
      },
    });
  } catch (err: any) {
    console.error("[TEST NOTIF]", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

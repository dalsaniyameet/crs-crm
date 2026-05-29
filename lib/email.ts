/**
 * Email Notifications — City Real Space CRM
 * Primary: Resend API (works on Vercel)
 * Fallback: GoDaddy SMTP (local dev)
 */

import nodemailer from "nodemailer";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "meetdalsaniya143@gmail.com,info@cityrealspace.com")
  .split(",").map(e => e.trim()).filter(Boolean);

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://crs-crm.vercel.app";
const FROM    = `"City Real Space CRM" <${process.env.EMAIL_USER || "info@cityrealspace.com"}>`;

// ── Resend API (Vercel-friendly) ──────────────────────────────────────────────
async function sendViaResend(to: string[], subject: string, html: string) {
  const { Resend } = await import("resend");
  const resend = new Resend(process.env.RESEND_API_KEY);
  const fromAddr = process.env.RESEND_DOMAIN_VERIFIED === "true"
    ? `City Real Space CRM <info@cityrealspace.com>`
    : "City Real Space CRM <onboarding@resend.dev>";
  const { error } = await resend.emails.send({
    from: fromAddr,
    to,
    subject,
    html,
  });
  if (error) throw new Error(`Resend error: ${(error as any).message || JSON.stringify(error)}`);
  console.log("[EMAIL] Resend OK →", to.join(", "));
}

// ── SMTP fallback (local dev / GoDaddy) ──────────────────────────────────────
function getTransporter() {
  if (!process.env.EMAIL_PASS || process.env.EMAIL_PASS === "YOUR_EMAIL_PASSWORD") return null;
  const port   = parseInt(process.env.EMAIL_PORT || "587");
  const secure = process.env.EMAIL_SECURE === "true" || port === 465;
  return nodemailer.createTransport({
    host:   process.env.EMAIL_HOST || "smtpout.secureserver.net",
    port,
    secure,
    auth: { user: process.env.EMAIL_USER || "info@cityrealspace.com", pass: process.env.EMAIL_PASS },
    tls: { rejectUnauthorized: false },
    connectionTimeout: 15000,
    greetingTimeout:   15000,
    socketTimeout:     15000,
  });
}

async function sendViaSMTP(to: string[], subject: string, html: string) {
  const t = getTransporter();
  if (!t) throw new Error("SMTP not configured — EMAIL_PASS missing");
  const info = await t.sendMail({ from: FROM, to: to.join(", "), subject, html });
  console.log("[EMAIL] SMTP OK:", info.messageId, "→", to.join(", "));
}

// ── Main dispatcher — SMTP first, Resend fallback ───────────────────────────
async function send(to: string[], subject: string, html: string) {
  if (process.env.EMAIL_PASS && process.env.EMAIL_PASS !== "YOUR_EMAIL_PASSWORD") {
    await sendViaSMTP(to, subject, html);
  } else if (process.env.RESEND_API_KEY) {
    await sendViaResend(to, subject, html);
  } else {
    throw new Error("No email transport configured");
  }
}

export async function sendAdminEmail(subject: string, html: string) {
  await send(ADMIN_EMAILS, subject, html);
}

export async function sendEmployeeEmail(to: string, subject: string, html: string) {
  if (!to) return;
  await send([to], subject, html);
}

// ── HTML helpers ──────────────────────────────────────────────────────────────
function baseTemplate(title: string, icon: string, color: string, rows: string, link: string, linkLabel: string) {
  return `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f4f6fb;padding:20px;border-radius:10px">
  <div style="background:#0f172a;padding:18px 24px;border-radius:8px 8px 0 0;display:flex;align-items:center">
    <span style="font-size:24px;margin-right:10px">${icon}</span>
    <div>
      <div style="color:#f59e0b;font-size:16px;font-weight:bold">City Real Space CRM</div>
      <div style="color:#94a3b8;font-size:13px">${title}</div>
    </div>
  </div>
  <div style="background:#fff;padding:20px;border-radius:0 0 8px 8px;border:1px solid #e2e8f0">
    <table style="width:100%;border-collapse:collapse">${rows}</table>
    <div style="margin-top:18px">
      <a href="${link}" style="display:inline-block;padding:10px 22px;background:${color};color:#fff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:bold">${linkLabel} →</a>
    </div>
  </div>
  <div style="text-align:center;color:#94a3b8;font-size:11px;margin-top:10px">City Real Space | Ahmedabad | cityrealspace.com</div>
</div>`;
}

function row(label: string, value: string, bg = "#fff") {
  return `<tr style="background:${bg}"><td style="padding:8px 10px;color:#64748b;font-size:13px;width:140px">${label}</td><td style="padding:8px 10px;color:#1e293b;font-size:14px">${value}</td></tr>`;
}

// ── 1. New Lead ───────────────────────────────────────────────────────────────
export function newLeadEmailHtml(lead: {
  name: string; phone: string; email?: string | null;
  source: string; propertyType?: string | null; budget?: number | null;
  requirements?: string | null; score: number; assignedTo?: string | null;
}) {
  const heat = lead.score >= 80 ? "🔥 HOT" : lead.score >= 60 ? "🌡️ WARM" : "❄️ COLD";
  const rows = [
    row("Name",          `<strong>${lead.name}</strong>`),
    row("Phone",         lead.phone, "#f8fafc"),
    lead.email         ? row("Email",         lead.email)                                          : "",
    row("Source",        lead.source, "#f8fafc"),
    lead.propertyType  ? row("Property Type", lead.propertyType)                                   : "",
    lead.budget        ? row("Budget",        `₹${lead.budget.toLocaleString("en-IN")}`, "#f8fafc") : "",
    lead.requirements  ? row("Requirements",  lead.requirements)                                   : "",
    row("AI Score",      `<strong style="color:#16a34a">${heat} — ${lead.score}/100</strong>`, "#f8fafc"),
    lead.assignedTo    ? row("Assigned To",   lead.assignedTo)                                     : "",
  ].join("");
  return baseTemplate("New Lead Alert", "🏠", "#16a34a", rows, `${APP_URL}/leads`, "View Lead");
}

// ── 2. New Property ───────────────────────────────────────────────────────────
export function newPropertyEmailHtml(p: {
  title: string; type: string; locality: string;
  price: number; transactionType: string; listedBy?: string | null;
}) {
  const rows = [
    row("Title",        `<strong>${p.title}</strong>`),
    row("Type",         p.type, "#f8fafc"),
    row("Locality",     p.locality),
    row("Price",        `₹${p.price.toLocaleString("en-IN")}`, "#f8fafc"),
    row("Transaction",  p.transactionType),
    p.listedBy ? row("Listed By", p.listedBy, "#f8fafc") : "",
  ].join("");
  return baseTemplate("New Property Added", "🏢", "#2563eb", rows, `${APP_URL}/properties`, "View Property");
}

// ── 3. New Site Visit ─────────────────────────────────────────────────────────
export function newVisitEmailHtml(v: {
  clientName: string; clientPhone: string;
  propertyTitle: string; scheduledAt: string; brokerName: string;
}) {
  const rows = [
    row("Client",       `<strong>${v.clientName}</strong>`),
    row("Phone",        v.clientPhone, "#f8fafc"),
    row("Property",     v.propertyTitle),
    row("Scheduled At", `<strong>${v.scheduledAt}</strong>`, "#f8fafc"),
    row("Broker",       v.brokerName),
  ].join("");
  return baseTemplate("Site Visit Scheduled", "📅", "#7c3aed", rows, `${APP_URL}/visits`, "View Visits");
}

// ── 4. New Deal ───────────────────────────────────────────────────────────────
export function newDealEmailHtml(d: {
  title: string; value: number; stage: string;
  clientName: string; brokerName?: string | null;
}) {
  const rows = [
    row("Deal",         `<strong>${d.title}</strong>`),
    row("Client",       d.clientName, "#f8fafc"),
    row("Value",        `<strong style="color:#16a34a">₹${d.value.toLocaleString("en-IN")}</strong>`),
    row("Stage",        d.stage, "#f8fafc"),
    d.brokerName ? row("Broker", d.brokerName) : "",
  ].join("");
  return baseTemplate("New Deal Created", "🤝", "#0891b2", rows, `${APP_URL}/deals`, "View Deals");
}

// ── 5. New Commission ─────────────────────────────────────────────────────────
export function newCommissionEmailHtml(c: {
  brokerName: string; dealTitle: string; amount: number; rate?: number | null;
}) {
  const rows = [
    row("Broker",       `<strong>${c.brokerName}</strong>`),
    row("Deal",         c.dealTitle, "#f8fafc"),
    row("Commission",   `<strong style="color:#16a34a">₹${c.amount.toLocaleString("en-IN")}</strong>`),
    c.rate ? row("Rate", `${c.rate}%`, "#f8fafc") : "",
  ].join("");
  return baseTemplate("Commission Recorded", "💰", "#d97706", rows, `${APP_URL}/commissions`, "View Commissions");
}

// ── 6. Leave Request ──────────────────────────────────────────────────────────
export function leaveRequestEmailHtml(l: {
  employeeName: string; type: string;
  fromDate: string; toDate: string; days: number; reason: string;
}) {
  const rows = [
    row("Employee",     `<strong>${l.employeeName}</strong>`),
    row("Leave Type",   l.type.replace("_", " "), "#f8fafc"),
    row("From",         l.fromDate),
    row("To",           l.toDate, "#f8fafc"),
    row("Days",         `${l.days} day${l.days !== 1 ? "s" : ""}`),
    row("Reason",       l.reason, "#f8fafc"),
  ].join("");
  return baseTemplate("Leave Request", "🗓️", "#dc2626", rows, `${APP_URL}/admin-employees`, "Review Leave");
}

// ── 7. Marketing Campaign ─────────────────────────────────────────────────────
export function newCampaignEmailHtml(c: {
  name: string; type: string; subject?: string | null;
  scheduledAt?: string | null; createdBy?: string | null;
}) {
  const rows = [
    row("Campaign",     `<strong>${c.name}</strong>`),
    row("Type",         c.type, "#f8fafc"),
    c.subject     ? row("Subject",      c.subject)                    : "",
    c.scheduledAt ? row("Scheduled At", c.scheduledAt, "#f8fafc")     : "",
    c.createdBy   ? row("Created By",   c.createdBy)                  : "",
  ].join("");
  return baseTemplate("New Campaign Created", "📣", "#7c3aed", rows, `${APP_URL}/marketing`, "View Campaign");
}

// ── 8. Punch In ───────────────────────────────────────────────────────────────
export function punchInEmailHtml(e: { employeeName: string; location: string; time: string }) {
  const rows = [
    row("Employee",  `<strong>${e.employeeName}</strong>`),
    row("Location",  e.location, "#f8fafc"),
    row("Punch In",  `<strong style="color:#16a34a">${e.time}</strong>`),
  ].join("");
  return baseTemplate("Employee Punch In", "🟢", "#16a34a", rows, `${APP_URL}/attendance`, "View Attendance");
}

// ── 9. Punch Out ──────────────────────────────────────────────────────────────
export function punchOutEmailHtml(e: {
  employeeName: string; location: string; punchIn: string; punchOut: string; workHours: string;
}) {
  const rows = [
    row("Employee",   `<strong>${e.employeeName}</strong>`),
    row("Location",   e.location, "#f8fafc"),
    row("Punch In",   e.punchIn),
    row("Punch Out",  `<strong>${e.punchOut}</strong>`, "#f8fafc"),
    row("Work Hours", `<strong style="color:#2563eb">${e.workHours} hrs</strong>`),
  ].join("");
  return baseTemplate("Employee Punch Out", "🔴", "#dc2626", rows, `${APP_URL}/attendance`, "View Attendance");
}

// ── 10. Employee Welcome ──────────────────────────────────────────────────────
export function employeeWelcomeEmailHtml(e: { name: string; position: string; email: string }) {
  return `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0f172a;padding:0;border-radius:12px;overflow:hidden">
  <div style="background:linear-gradient(135deg,#1e3a5f 0%,#0f172a 100%);padding:32px 32px 24px;text-align:center">
    <div style="font-size:48px;margin-bottom:12px">🏙️</div>
    <h1 style="color:#f59e0b;font-size:22px;margin:0 0 6px;font-weight:700">Welcome to City Real Space CRM</h1>
    <p style="color:#94a3b8;font-size:14px;margin:0">Ahmedabad's Most Intelligent Real Estate Platform</p>
  </div>
  <div style="background:#1e293b;padding:28px 32px">
    <p style="color:#e2e8f0;font-size:16px;margin:0 0 20px">Hi <strong style="color:#f59e0b">${e.name}</strong> 👋,</p>
    <div style="background:#0f172a;border:1px solid #334155;border-radius:8px;padding:16px;margin-bottom:24px">
      <table style="width:100%">
        <tr><td style="color:#64748b;font-size:13px;padding:6px 0">Name</td><td style="color:#fff;font-size:13px;font-weight:600">${e.name}</td></tr>
        <tr><td style="color:#64748b;font-size:13px;padding:6px 0">Position</td><td style="color:#f59e0b;font-size:13px;font-weight:600">${e.position}</td></tr>
        <tr><td style="color:#64748b;font-size:13px;padding:6px 0">Email</td><td style="color:#94a3b8;font-size:13px">${e.email}</td></tr>
      </table>
    </div>
    <div style="text-align:center">
      <a href="${APP_URL}/employee" style="display:inline-block;padding:12px 28px;background:#f59e0b;color:#0f172a;text-decoration:none;border-radius:8px;font-size:14px;font-weight:700">Open My Dashboard →</a>
    </div>
  </div>
  <div style="background:#0f172a;padding:16px 32px;text-align:center;border-top:1px solid #1e293b">
    <p style="color:#475569;font-size:11px;margin:0">City Real Space | Ahmedabad | cityrealspace.com</p>
  </div>
</div>`;
}

// ── 11. New Lead Message ──────────────────────────────────────────────────────
export function newLeadMessageEmailHtml(m: {
  leadName: string; leadPhone: string; message: string; channel: string;
}) {
  const rows = [
    row("From",    `<strong>${m.leadName}</strong>`),
    row("Phone",   m.leadPhone, "#f8fafc"),
    row("Channel", m.channel),
    row("Message", `<em style="color:#1e293b">${m.message}</em>`, "#f8fafc"),
  ].join("");
  return baseTemplate("New Message from Lead", "💬", "#16a34a", rows, `${APP_URL}/leads`, "View Lead");
}

// ── 12. Daily Report ─────────────────────────────────────────────────────────
export function dailyReportEmailHtml(r: {
  employeeName: string; date: string;
  totalCalls: number; connectedCalls: number; newLeads: number;
  siteVisits: number; dealsClosed: number; dealValue: number;
  highlights?: string | null; challenges?: string | null; tomorrowPlan?: string | null;
}) {
  const rows = [
    row("Employee",     `<strong>${r.employeeName}</strong>`),
    row("Date",         r.date, "#f8fafc"),
    row("Total Calls",  `${r.totalCalls} (${r.connectedCalls} connected)`),
    row("New Leads",    `<strong style="color:#d97706">${r.newLeads}</strong>`, "#f8fafc"),
    row("Site Visits",  String(r.siteVisits)),
    row("Deals Closed", `<strong style="color:#16a34a">${r.dealsClosed}</strong>`, "#f8fafc"),
    r.dealValue > 0   ? row("Deal Value",    `₹${r.dealValue.toLocaleString("en-IN")}`)  : "",
    r.highlights      ? row("Highlights",    r.highlights, "#f8fafc")                    : "",
    r.challenges      ? row("Challenges",    r.challenges)                               : "",
    r.tomorrowPlan    ? row("Tomorrow Plan", r.tomorrowPlan, "#f8fafc")                  : "",
  ].join("");
  return baseTemplate("Daily Report Submitted", "📋", "#7c3aed", rows, `${APP_URL}/admin-employees/daily-reports`, "View Reports");
}

// ── Employee: Punch In Confirmation ──────────────────────────────────────────
export function empPunchInEmailHtml(e: { name: string; location: string; time: string }) {
  const rows = [
    row("Name",      `<strong>${e.name}</strong>`),
    row("Location",  e.location, "#f8fafc"),
    row("Punch In",  `<strong style="color:#16a34a">${e.time}</strong>`),
    row("Status",    "✅ Attendance recorded", "#f8fafc"),
  ].join("");
  return baseTemplate("Punch In Confirmed", "🟢", "#16a34a", rows, `${APP_URL}/employee`, "View My Attendance");
}

// ── Employee: Punch Out Summary ───────────────────────────────────────────────
export function empPunchOutEmailHtml(e: {
  name: string; location: string; punchIn: string; punchOut: string;
  workHours: string; lateMinutes: number; overtimeHours: number;
}) {
  const rows = [
    row("Name",       `<strong>${e.name}</strong>`),
    row("Location",   e.location, "#f8fafc"),
    row("Punch In",   e.punchIn),
    row("Punch Out",  `<strong>${e.punchOut}</strong>`, "#f8fafc"),
    row("Work Hours", `<strong style="color:#2563eb">${e.workHours} hrs</strong>`),
    e.lateMinutes > 0   ? row("Late By",  `<span style="color:#dc2626">${e.lateMinutes} min</span>`, "#f8fafc") : "",
    e.overtimeHours > 0 ? row("Overtime", `<span style="color:#16a34a">+${e.overtimeHours.toFixed(1)} hrs</span>`) : "",
  ].join("");
  return baseTemplate("Punch Out Summary", "🔴", "#2563eb", rows, `${APP_URL}/employee`, "View My Attendance");
}

// ── Employee: Leave Status ────────────────────────────────────────────────────
export function empLeaveStatusEmailHtml(e: {
  name: string; type: string; fromDate: string; toDate: string;
  days: number; status: "APPROVED" | "REJECTED"; adminNote?: string | null;
}) {
  const approved = e.status === "APPROVED";
  const rows = [
    row("Employee",   `<strong>${e.name}</strong>`),
    row("Leave Type", e.type.replace(/_/g, " "), "#f8fafc"),
    row("From",       e.fromDate),
    row("To",         e.toDate, "#f8fafc"),
    row("Days",       `${e.days} day${e.days !== 1 ? "s" : ""}`),
    row("Status",     `<strong style="color:${approved ? "#16a34a" : "#dc2626"}">${approved ? "✅ APPROVED" : "❌ REJECTED"}</strong>`, "#f8fafc"),
    e.adminNote ? row("Admin Note", `<em>${e.adminNote}</em>`) : "",
  ].join("");
  return baseTemplate(
    approved ? "Leave Approved" : "Leave Rejected",
    approved ? "✅" : "❌",
    approved ? "#16a34a" : "#dc2626",
    rows, `${APP_URL}/employee`, "View My Leaves"
  );
}

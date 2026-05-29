import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendAdminEmail } from "@/lib/email";

const CRON_SECRET = process.env.CRON_SECRET || "crs-daily-2024";

function istDay() {
  const now = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  const y = now.getUTCFullYear(), m = now.getUTCMonth(), d = now.getUTCDate();
  return { start: new Date(Date.UTC(y, m, d, 0, 0, 0) - 5.5 * 60 * 60 * 1000), end: new Date(Date.UTC(y, m, d, 23, 59, 59) - 5.5 * 60 * 60 * 1000) };
}

function fmt(n: number) { return n.toLocaleString("en-IN"); }

function summaryHtml(data: {
  date: string; newLeads: number; newProperties: number; newDeals: number;
  visitsScheduled: number; commissions: number; commissionValue: number;
  punchIns: number; leaveRequests: number; dailyReports: number;
  topLeads: { name: string; phone: string; source: string; score: number }[];
  topDeals: { title: string; value: number; stage: string }[];
}) {
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://cityrealspacecrm.com";

  const statBox = (icon: string, label: string, val: string | number, color: string) =>
    `<td style="width:25%;padding:8px"><div style="background:#0f172a;border:1px solid #1e293b;border-radius:8px;padding:14px;text-align:center">
      <div style="font-size:22px">${icon}</div>
      <div style="color:${color};font-size:20px;font-weight:700;margin:4px 0">${val}</div>
      <div style="color:#64748b;font-size:11px">${label}</div>
    </div></td>`;

  const leadRows = data.topLeads.map(l =>
    `<tr><td style="padding:6px 10px;color:#e2e8f0;font-size:13px">${l.name}</td>
     <td style="padding:6px 10px;color:#94a3b8;font-size:12px">${l.phone}</td>
     <td style="padding:6px 10px;color:#94a3b8;font-size:12px">${l.source}</td>
     <td style="padding:6px 10px;text-align:right"><span style="color:${l.score>=80?"#4ade80":l.score>=60?"#fbbf24":"#94a3b8"};font-weight:600">${l.score}</span></td></tr>`
  ).join("");

  const dealRows = data.topDeals.map(d =>
    `<tr><td style="padding:6px 10px;color:#e2e8f0;font-size:13px">${d.title}</td>
     <td style="padding:6px 10px;color:#4ade80;font-size:13px;font-weight:600">₹${fmt(d.value)}</td>
     <td style="padding:6px 10px;color:#94a3b8;font-size:12px">${d.stage}</td></tr>`
  ).join("");

  return `
<div style="font-family:Arial,sans-serif;max-width:650px;margin:0 auto;background:#0f172a;border-radius:12px;overflow:hidden">
  <div style="background:linear-gradient(135deg,#1e3a5f,#0f172a);padding:28px 32px;text-align:center">
    <div style="font-size:36px">📊</div>
    <h1 style="color:#f59e0b;font-size:20px;margin:8px 0 4px;font-weight:700">Daily CRM Summary</h1>
    <p style="color:#94a3b8;font-size:13px;margin:0">${data.date} — City Real Space, Ahmedabad</p>
  </div>

  <div style="padding:24px 28px">
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
      <tr>
        ${statBox("🏠", "New Leads", data.newLeads, "#4ade80")}
        ${statBox("🏢", "Properties", data.newProperties, "#60a5fa")}
        ${statBox("🤝", "New Deals", data.newDeals, "#f59e0b")}
        ${statBox("📅", "Site Visits", data.visitsScheduled, "#a78bfa")}
      </tr>
      <tr>
        ${statBox("💰", "Commissions", data.commissions, "#34d399")}
        ${statBox("💵", "Commission ₹", `₹${fmt(data.commissionValue)}`, "#34d399")}
        ${statBox("🟢", "Punch Ins", data.punchIns, "#4ade80")}
        ${statBox("📋", "Daily Reports", data.dailyReports, "#94a3b8")}
      </tr>
    </table>

    ${data.topLeads.length ? `
    <div style="margin-bottom:20px">
      <h3 style="color:#f59e0b;font-size:14px;margin:0 0 10px;border-bottom:1px solid #1e293b;padding-bottom:8px">🏠 Today's Leads</h3>
      <table style="width:100%;border-collapse:collapse;background:#1e293b;border-radius:8px;overflow:hidden">
        <tr style="background:#0f172a"><th style="padding:8px 10px;color:#64748b;font-size:11px;text-align:left">Name</th><th style="padding:8px 10px;color:#64748b;font-size:11px;text-align:left">Phone</th><th style="padding:8px 10px;color:#64748b;font-size:11px;text-align:left">Source</th><th style="padding:8px 10px;color:#64748b;font-size:11px;text-align:right">Score</th></tr>
        ${leadRows}
      </table>
    </div>` : ""}

    ${data.topDeals.length ? `
    <div style="margin-bottom:20px">
      <h3 style="color:#f59e0b;font-size:14px;margin:0 0 10px;border-bottom:1px solid #1e293b;padding-bottom:8px">🤝 Today's Deals</h3>
      <table style="width:100%;border-collapse:collapse;background:#1e293b;border-radius:8px;overflow:hidden">
        <tr style="background:#0f172a"><th style="padding:8px 10px;color:#64748b;font-size:11px;text-align:left">Deal</th><th style="padding:8px 10px;color:#64748b;font-size:11px;text-align:left">Value</th><th style="padding:8px 10px;color:#64748b;font-size:11px;text-align:left">Stage</th></tr>
        ${dealRows}
      </table>
    </div>` : ""}

    ${data.leaveRequests > 0 ? `<div style="background:#1e293b;border:1px solid #334155;border-radius:8px;padding:12px 16px;margin-bottom:16px"><p style="color:#fbbf24;font-size:13px;margin:0">⚠️ <strong>${data.leaveRequests}</strong> pending leave request${data.leaveRequests>1?"s":""} need your attention.</p></div>` : ""}

    <div style="text-align:center;margin-top:20px">
      <a href="${APP_URL}/dashboard" style="display:inline-block;padding:12px 28px;background:#f59e0b;color:#0f172a;text-decoration:none;border-radius:8px;font-size:14px;font-weight:700">Open Dashboard →</a>
    </div>
  </div>
  <div style="background:#0a0f1a;padding:14px 28px;text-align:center;border-top:1px solid #1e293b">
    <p style="color:#475569;font-size:11px;margin:0">City Real Space CRM | Automated Daily Summary | cityrealspace.com</p>
  </div>
</div>`;
}

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (secret !== CRON_SECRET)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { start, end } = istDay();

  const [newLeads, newProperties, newDeals, visitsScheduled, commissions, punchIns, leaveRequests, dailyReports, topLeads, topDeals] = await Promise.all([
    prisma.lead.count({ where: { createdAt: { gte: start, lte: end } } }),
    prisma.property.count({ where: { createdAt: { gte: start, lte: end } } }),
    prisma.deal.count({ where: { createdAt: { gte: start, lte: end } } }),
    prisma.visit.count({ where: { createdAt: { gte: start, lte: end } } }),
    prisma.commission.count({ where: { createdAt: { gte: start, lte: end } } }),
    prisma.attendance.count({ where: { punchIn: { gte: start, lte: end } } }),
    prisma.leave.count({ where: { status: "PENDING" } }),
    prisma.dailyReport?.count({ where: { createdAt: { gte: start, lte: end } } }).catch(() => 0) ?? Promise.resolve(0),
    prisma.lead.findMany({ where: { createdAt: { gte: start, lte: end } }, orderBy: { score: "desc" }, take: 5, select: { name: true, phone: true, source: true, score: true } }),
    prisma.deal.findMany({ where: { createdAt: { gte: start, lte: end } }, orderBy: { value: "desc" }, take: 5, select: { title: true, value: true, stage: true } }),
  ]);

  const commissionAgg = await prisma.commission.aggregate({ where: { createdAt: { gte: start, lte: end } }, _sum: { amount: true } });

  const dateStr = new Date(Date.now() + 5.5 * 60 * 60 * 1000).toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const html = summaryHtml({
    date: dateStr, newLeads, newProperties, newDeals, visitsScheduled,
    commissions, commissionValue: commissionAgg._sum.amount ?? 0,
    punchIns, leaveRequests, dailyReports: dailyReports as number,
    topLeads, topDeals,
  });

  await sendAdminEmail(`📊 Daily CRM Summary — ${dateStr}`, html);

  return NextResponse.json({ ok: true, date: dateStr, stats: { newLeads, newProperties, newDeals, visitsScheduled, commissions, punchIns, leaveRequests } });
}

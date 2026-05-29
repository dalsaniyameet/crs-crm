/**
 * Central Notification Helper — City Real Space CRM
 * Sends DB notification to all admins + email for every CRM event
 */

import { prisma } from "@/lib/prisma";
import { sendAdminEmail } from "@/lib/email";
import {
  newLeadEmailHtml,
  newPropertyEmailHtml,
  newVisitEmailHtml,
  newDealEmailHtml,
  newCommissionEmailHtml,
  leaveRequestEmailHtml,
  punchInEmailHtml,
  punchOutEmailHtml,
  dailyReportEmailHtml,
} from "@/lib/email";

// Get all admin user IDs from DB
async function getAdminIds(): Promise<string[]> {
  const admins = await prisma.user.findMany({
    where: { role: { in: ["ADMIN" as any, "SALES_MANAGER" as any] }, isActive: true },
    select: { id: true },
  });
  return admins.map(a => a.id);
}

// Create notification for multiple users
async function createNotifications(
  userIds: string[],
  type: string,
  title: string,
  message: string,
  extra?: { leadId?: string }
) {
  if (!userIds.length) return;
  await Promise.all(
    userIds.map(userId =>
      prisma.notification.create({
        data: { userId, type: type as any, title, message, leadId: extra?.leadId },
      }).catch(() => {})
    )
  );
}

// ── 1. New Lead ───────────────────────────────────────────────────────────────
export async function notifyNewLead(lead: {
  id: string; name: string; phone: string; email?: string | null;
  source: string; propertyType?: string | null; budget?: number | null;
  requirements?: string | null; score: number; assignedTo?: string | null;
  assignedToId?: string | null;
}) {
  const adminIds = await getAdminIds();
  const notifyIds = [...new Set([...adminIds, ...(lead.assignedToId ? [lead.assignedToId] : [])])];

  await createNotifications(
    notifyIds,
    "LEAD_ASSIGNED",
    `New Lead: ${lead.name}`,
    `${lead.name} (${lead.phone}) from ${lead.source}. Score: ${lead.score}/100.${lead.requirements ? ` Req: ${lead.requirements}` : ""}`,
    { leadId: lead.id }
  );

  await sendAdminEmail(
    `New Lead: ${lead.name} (Score: ${lead.score})`,
    newLeadEmailHtml(lead)
  );
}

// ── 2. New Property ───────────────────────────────────────────────────────────
export async function notifyNewProperty(p: {
  title: string; type: string; locality: string;
  price: number; transactionType: string; listedBy?: string | null;
}) {
  const adminIds = await getAdminIds();
  await createNotifications(
    adminIds,
    "SYSTEM",
    `New Property: ${p.title}`,
    `${p.type} in ${p.locality} — ₹${p.price.toLocaleString("en-IN")} (${p.transactionType})`
  );

  sendAdminEmail(
    `New Property: ${p.title} — ${p.locality}`,
    newPropertyEmailHtml(p)
  ).catch(() => {});
}

// ── 3. New Site Visit ─────────────────────────────────────────────────────────
export async function notifyNewVisit(v: {
  clientName: string; clientPhone: string;
  propertyTitle: string; scheduledAt: string;
  brokerName: string; brokerId?: string | null; leadId?: string | null;
}) {
  const adminIds = await getAdminIds();
  const notifyIds = [...new Set([...adminIds, ...(v.brokerId ? [v.brokerId] : [])])];

  await createNotifications(
    notifyIds,
    "SITE_VISIT_REMINDER",
    `Site Visit: ${v.clientName}`,
    `${v.clientName} → ${v.propertyTitle} on ${v.scheduledAt}. Broker: ${v.brokerName}`,
    { leadId: v.leadId || undefined }
  );

  sendAdminEmail(
    `Site Visit Scheduled: ${v.clientName}`,
    newVisitEmailHtml(v)
  ).catch(() => {});
}

// ── 4. New Deal ───────────────────────────────────────────────────────────────
export async function notifyNewDeal(d: {
  title: string; value: number; stage: string;
  clientName: string; brokerName?: string | null;
  brokerId?: string | null; leadId?: string | null;
}) {
  const adminIds = await getAdminIds();
  const notifyIds = [...new Set([...adminIds, ...(d.brokerId ? [d.brokerId] : [])])];

  await createNotifications(
    notifyIds,
    "DEAL_UPDATE",
    `New Deal: ${d.title}`,
    `${d.clientName} — ₹${d.value.toLocaleString("en-IN")} | Stage: ${d.stage}${d.brokerName ? ` | Broker: ${d.brokerName}` : ""}`,
    { leadId: d.leadId || undefined }
  );

  sendAdminEmail(
    `New Deal: ${d.title} — ₹${d.value.toLocaleString("en-IN")}`,
    newDealEmailHtml(d)
  ).catch(() => {});
}

// ── 5. Deal Stage Changed ─────────────────────────────────────────────────────
export async function notifyDealStageChange(d: {
  title: string; stage: string; value: number;
  clientName: string; brokerId?: string | null; leadId?: string | null;
}) {
  const adminIds = await getAdminIds();
  const notifyIds = [...new Set([...adminIds, ...(d.brokerId ? [d.brokerId] : [])])];

  await createNotifications(
    notifyIds,
    "DEAL_UPDATE",
    `Deal Update: ${d.title}`,
    `"${d.title}" moved to ${d.stage}. Value: ₹${d.value.toLocaleString("en-IN")}. Client: ${d.clientName}`,
    { leadId: d.leadId || undefined }
  );

  sendAdminEmail(
    `Deal Stage Update: ${d.title} → ${d.stage}`,
    newDealEmailHtml({ ...d, brokerName: null })
  ).catch(() => {});
}

// ── 6. New Commission ─────────────────────────────────────────────────────────
export async function notifyNewCommission(c: {
  brokerName: string; dealTitle: string; amount: number;
  rate?: number | null; brokerId?: string | null;
}) {
  const adminIds = await getAdminIds();
  const notifyIds = [...new Set([...adminIds, ...(c.brokerId ? [c.brokerId] : [])])];

  await createNotifications(
    notifyIds,
    "DEAL_UPDATE",
    `Commission: ${c.brokerName}`,
    `₹${c.amount.toLocaleString("en-IN")} commission recorded for ${c.brokerName} on deal "${c.dealTitle}"`
  );

  sendAdminEmail(
    `Commission Recorded: ${c.brokerName} — ₹${c.amount.toLocaleString("en-IN")}`,
    newCommissionEmailHtml(c)
  ).catch(() => {});
}

// ── 7. Leave Request ──────────────────────────────────────────────────────────
export async function notifyLeaveRequest(l: {
  employeeName: string; type: string;
  fromDate: string; toDate: string; days: number; reason: string;
}) {
  const adminIds = await getAdminIds();

  await createNotifications(
    adminIds,
    "LEAVE_REQUEST",
    `Leave Request: ${l.employeeName}`,
    `${l.employeeName} applied for ${l.type.replace("_", " ")} leave (${l.days} day${l.days !== 1 ? "s" : ""}) from ${l.fromDate} to ${l.toDate}. Reason: ${l.reason}`
  );

  sendAdminEmail(
    `Leave Request: ${l.employeeName} (${l.type.replace("_", " ")})`,
    leaveRequestEmailHtml(l)
  ).catch(() => {});
}

// ── 8. Punch In ───────────────────────────────────────────────────────────────
export async function notifyPunchIn(e: {
  employeeName: string; location: string; time: string;
}) {
  const adminIds = await getAdminIds();

  await createNotifications(
    adminIds,
    "SYSTEM",
    `Punch In: ${e.employeeName}`,
    `${e.employeeName} punched in at ${e.location} — ${e.time}`
  );

  sendAdminEmail(
    `Punch In: ${e.employeeName} — ${e.time}`,
    punchInEmailHtml(e)
  ).catch(() => {});
}

// ── 9. Punch Out ──────────────────────────────────────────────────────────────
export async function notifyPunchOut(e: {
  employeeName: string; location: string;
  punchIn: string; punchOut: string; workHours: string;
}) {
  const adminIds = await getAdminIds();

  await createNotifications(
    adminIds,
    "SYSTEM",
    `Punch Out: ${e.employeeName}`,
    `${e.employeeName} worked ${e.workHours} hrs at ${e.location}`
  );

  sendAdminEmail(
    `Punch Out: ${e.employeeName} — ${e.workHours} hrs`,
    punchOutEmailHtml(e)
  ).catch(() => {});
}

// ── 10. Daily Report ──────────────────────────────────────────────────────────
export async function notifyDailyReport(r: {
  employeeName: string; date: string;
  totalCalls: number; connectedCalls: number; newLeads: number;
  siteVisits: number; dealsClosed: number; dealValue: number;
  highlights?: string | null; challenges?: string | null; tomorrowPlan?: string | null;
}) {
  const adminIds = await getAdminIds();

  await createNotifications(
    adminIds,
    "SYSTEM",
    `Daily Report: ${r.employeeName}`,
    `${r.employeeName} submitted report for ${r.date}. Calls: ${r.totalCalls}, Leads: ${r.newLeads}, Deals closed: ${r.dealsClosed}`
  );

  sendAdminEmail(
    `Daily Report: ${r.employeeName} — ${r.date}`,
    dailyReportEmailHtml(r)
  ).catch(() => {});
}

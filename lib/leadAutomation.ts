/**
 * Lead Lifecycle Automation — City Real Space CRM
 * Triggered on every lead status change / update
 * Handles: notifications, WhatsApp, follow-up tasks, deal creation, activity logs
 */

import { prisma } from "@/lib/prisma";
import { sendWhatsApp } from "@/lib/whatsapp";

// ── Real Estate Lead Journey ──────────────────────────────────────────────────
// NEW → CONTACTED → SITE_VISIT_SCHEDULED → NEGOTIATION → DEAL_CLOSED / LOST
// Each step triggers: notification + WA to client + follow-up task for broker

export const LEAD_STATUS_LABELS: Record<string, string> = {
  NEW:                   "New Lead",
  CONTACTED:             "Contacted",
  SITE_VISIT_SCHEDULED:  "Site Visit Scheduled",
  NEGOTIATION:           "In Negotiation",
  DEAL_CLOSED:           "Deal Closed 🎉",
  LOST:                  "Lost",
};

// Next suggested step for each status
export const NEXT_STEP: Record<string, { status: string; task: string; daysFromNow: number }> = {
  NEW:                  { status: "CONTACTED",            task: "Call lead & understand requirements",    daysFromNow: 0 },
  CONTACTED:            { status: "SITE_VISIT_SCHEDULED", task: "Schedule site visit for shortlisted properties", daysFromNow: 2 },
  SITE_VISIT_SCHEDULED: { status: "NEGOTIATION",          task: "Follow up after site visit — get feedback",     daysFromNow: 1 },
  NEGOTIATION:          { status: "DEAL_CLOSED",          task: "Finalize deal terms & prepare token agreement", daysFromNow: 3 },
  DEAL_CLOSED:          { status: "DEAL_CLOSED",          task: "Collect commission & get referral",             daysFromNow: 7 },
};

// WhatsApp messages to CLIENT at each stage
const CLIENT_WA_MESSAGES: Record<string, (name: string, extra?: string) => string> = {
  CONTACTED: (name) =>
    `Hi ${name}! 👋\n\nThank you for connecting with *City Real Space*, Ahmedabad's trusted real estate brokerage.\n\nWe've noted your requirements and our team will reach out shortly with the best matching properties.\n\n📞 City Real Space | Ahmedabad\n🌐 cityrealspace.com`,

  SITE_VISIT_SCHEDULED: (name, details) =>
    `Hi ${name}! 🏠\n\n*Site Visit Confirmed!*\n\n${details || "Your site visit has been scheduled."}\n\nPlease reply CONFIRM to confirm your visit or RESCHEDULE if you need to change the time.\n\n📍 City Real Space, Ahmedabad`,

  NEGOTIATION: (name) =>
    `Hi ${name}! 🤝\n\nGreat news! We're moving forward with your property deal.\n\nOur team will contact you shortly to discuss the final terms.\n\nThank you for choosing *City Real Space*! 🏢\n\n📞 City Real Space | Ahmedabad`,

  DEAL_CLOSED: (name) =>
    `Hi ${name}! 🎉\n\n*Congratulations on your new property!*\n\nIt was a pleasure working with you at *City Real Space*.\n\nWe'd love a referral if you know anyone looking for property in Ahmedabad! 🙏\n\n📞 City Real Space | Ahmedabad`,

  LOST: (name) =>
    `Hi ${name}! 👋\n\nWe understand you've decided to hold off for now.\n\nWhenever you're ready to explore properties in Ahmedabad, we're here for you!\n\n📞 City Real Space | Ahmedabad`,
};

// ── Main Automation Function ──────────────────────────────────────────────────
export async function runLeadAutomation(params: {
  leadId:      string;
  newStatus:   string;
  oldStatus:   string;
  triggeredBy: string; // userId
  extra?:      Record<string, any>;
}) {
  const { leadId, newStatus, oldStatus, triggeredBy, extra } = params;

  if (newStatus === oldStatus) return; // no change

  const lead = await prisma.lead.findUnique({
    where:   { id: leadId },
    include: { assignedTo: { select: { id: true, name: true } } },
  });
  if (!lead) return;

  const brokerName = lead.assignedTo?.name || "Team";
  const brokerId   = lead.assignedTo?.id;

  // ── 1. Activity Log ──────────────────────────────────────────────────────
  await prisma.activity.create({
    data: {
      type:        "STATUS_CHANGED",
      description: `Lead status changed: ${LEAD_STATUS_LABELS[oldStatus] || oldStatus} → ${LEAD_STATUS_LABELS[newStatus] || newStatus}`,
      leadId,
      userId: triggeredBy,
    },
  });

  // ── 2. Notification to assigned broker ──────────────────────────────────
  if (brokerId) {
    await prisma.notification.create({
      data: {
        userId:  brokerId,
        type:    "LEAD_ASSIGNED",
        title:   `Lead Update: ${lead.name}`,
        message: `${lead.name}'s status changed to "${LEAD_STATUS_LABELS[newStatus] || newStatus}". ${NEXT_STEP[newStatus]?.task || ""}`,
        leadId,
      },
    });
  }

  // Notify all admins too
  const admins = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "SALES_MANAGER"] }, isActive: true },
    select: { id: true },
  });
  await Promise.all(
    admins
      .filter(a => a.id !== brokerId && a.id !== triggeredBy)
      .map(a =>
        prisma.notification.create({
          data: {
            userId:  a.id,
            type:    "LEAD_ASSIGNED",
            title:   `Lead Update: ${lead.name}`,
            message: `${lead.name} → ${LEAD_STATUS_LABELS[newStatus] || newStatus} (by ${brokerName})`,
            leadId,
          },
        })
      )
  );

  // ── 3. Auto follow-up task for broker ───────────────────────────────────
  const nextStep = NEXT_STEP[newStatus];
  if (nextStep && brokerId) {
    const dueAt = new Date();
    dueAt.setDate(dueAt.getDate() + nextStep.daysFromNow);
    dueAt.setHours(10, 0, 0, 0); // 10 AM

    await prisma.task.create({
      data: {
        title:       nextStep.task,
        description: `Auto-created for lead: ${lead.name} (${lead.phone})`,
        dueAt,
        priority:    newStatus === "NEGOTIATION" ? "HIGH" : newStatus === "SITE_VISIT_SCHEDULED" ? "HIGH" : "MEDIUM",
        assignedToId: brokerId,
        leadId,
      },
    });

    // Update nextFollowUpAt on lead
    await prisma.lead.update({
      where: { id: leadId },
      data:  { nextFollowUpAt: dueAt, lastContactedAt: new Date() },
    });
  }

  // ── 4. WhatsApp to client ────────────────────────────────────────────────
  const waMsg = CLIENT_WA_MESSAGES[newStatus];
  if (waMsg && lead.phone) {
    const msgText = waMsg(
      lead.name,
      extra?.visitDetails || undefined
    );
    try {
      await sendWhatsApp(lead.phone, msgText);
      await prisma.activity.create({
        data: {
          type:        "WHATSAPP_SENT",
          description: `WhatsApp sent to ${lead.name}: ${newStatus} notification`,
          leadId,
          userId: triggeredBy,
        },
      });
    } catch {
      // WA send failure should not block the flow
    }
  }

  // ── 5. Auto-create Deal on NEGOTIATION ──────────────────────────────────
  if (newStatus === "NEGOTIATION") {
    const existingDeal = await prisma.deal.findFirst({
      where: { leadId, stage: { notIn: ["CLOSED", "CANCELLED"] } },
    });
    if (!existingDeal) {
      const dealValue      = lead.budget ?? 500000;
      const commissionRate = 2;
      const commission     = Math.round(dealValue * commissionRate / 100);

      const deal = await prisma.deal.create({
        data: {
          title:          `${lead.name} — ${lead.propertyType || "Property"} Deal`,
          leadId,
          stage:          "NEGOTIATION",
          value:          dealValue,
          commissionRate,
          commission,
          brokerId:       brokerId || undefined,
          notes:          "Auto-created when lead moved to Negotiation.",
        },
      });

      await prisma.activity.create({
        data: {
          type:        "DEAL_AUTO_CREATED",
          description: `Deal auto-created: ₹${dealValue.toLocaleString("en-IN")}`,
          leadId,
          dealId:      deal.id,
          userId:      triggeredBy,
        },
      });

      // Notify broker about new deal
      if (brokerId) {
        await prisma.notification.create({
          data: {
            userId:  brokerId,
            type:    "DEAL_UPDATE",
            title:   `New Deal Created: ${lead.name}`,
            message: `A deal of ₹${dealValue.toLocaleString("en-IN")} has been auto-created for ${lead.name}. Commission: ₹${commission.toLocaleString("en-IN")}`,
            leadId,
          },
        });
      }
    }
  }

  // ── 6. Auto-create Commission on DEAL_CLOSED ────────────────────────────
  if (newStatus === "DEAL_CLOSED" && brokerId) {
    const deal = await prisma.deal.findFirst({
      where: { leadId, stage: { notIn: ["CANCELLED"] } },
      orderBy: { createdAt: "desc" },
    });

    if (deal) {
      // Close the deal
      await prisma.deal.update({
        where: { id: deal.id },
        data:  { stage: "CLOSED", closedAt: new Date() },
      });

      // Create commission record if not exists
      const existingComm = await prisma.commission.findFirst({ where: { dealId: deal.id, brokerId } });
      if (!existingComm && deal.commission) {
        await prisma.commission.create({
          data: {
            dealId:   deal.id,
            brokerId,
            amount:   deal.commission,
            rate:     deal.commissionRate || 2,
            isPaid:   false,
          },
        });
      }

      // Notify broker
      await prisma.notification.create({
        data: {
          userId:  brokerId,
          type:    "DEAL_UPDATE",
          title:   `🎉 Deal Closed: ${lead.name}`,
          message: `Congratulations! Deal closed for ${lead.name}. Commission of ₹${(deal.commission || 0).toLocaleString("en-IN")} has been recorded.`,
          leadId,
        },
      });
    }
  }
}

// ── Score-based follow-up reminder ───────────────────────────────────────────
// Call this from a cron job or on dashboard load
export async function checkOverdueFollowUps() {
  const now = new Date();
  const overdue = await prisma.lead.findMany({
    where: {
      nextFollowUpAt: { lt: now },
      status:         { notIn: ["DEAL_CLOSED", "LOST"] },
      assignedToId:   { not: null },
    },
    include: { assignedTo: { select: { id: true, name: true } } },
    take: 50,
  });

  for (const lead of overdue) {
    if (!lead.assignedTo) continue;
    // Check if notification already sent today
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const existing = await prisma.notification.findFirst({
      where: {
        userId:    lead.assignedTo.id,
        leadId:    lead.id,
        type:      "FOLLOW_UP_DUE",
        createdAt: { gte: today },
      },
    });
    if (existing) continue;

    await prisma.notification.create({
      data: {
        userId:  lead.assignedTo.id,
        type:    "FOLLOW_UP_DUE",
        title:   `⏰ Overdue Follow-up: ${lead.name}`,
        message: `Follow-up for ${lead.name} was due on ${lead.nextFollowUpAt?.toLocaleDateString("en-IN")}. Please contact them now!`,
        leadId:  lead.id,
      },
    });
  }

  return overdue.length;
}

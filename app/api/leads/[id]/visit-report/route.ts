import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { sendAdminEmail } from "@/lib/email";

async function getUser(clerkId: string) {
  return prisma.user.findUnique({ where: { clerkId } });
}

// GET — fetch visit reports for a lead
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const reports = await prisma.activity.findMany({
    where: { leadId: params.id, type: "VISIT_REPORT" },
    include: { user: { select: { id: true, name: true, avatar: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(reports);
}

// POST — employee submits visit report
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await getUser(userId);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const lead = await prisma.lead.findUnique({
    where: { id: params.id },
    select: { id: true, name: true, phone: true, assignedToId: true, budget: true, requirements: true, propertyType: true },
  });
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  if (user.role !== "ADMIN" && lead.assignedToId !== user.id)
    return NextResponse.json({ error: "Access denied" }, { status: 403 });

  const body = await req.json();
  const {
    // Properties shown to client
    propertiesShown,       // [{propertyId, propertyName, locality, ownerName, ownerPhone, price}]
    // Client feedback
    clientInterest,        // HOT / WARM / COLD
    clientFeedback,        // free text
    budgetConfirmed,       // number
    requirementConfirmed,  // free text
    locationConfirmed,     // boolean
    locationNotes,         // which areas client liked
    // Next steps
    nextStep,              // FOLLOW_UP / ANOTHER_VISIT / NEGOTIATION / DEAL_CLOSED / NOT_INTERESTED
    nextFollowUpDate,
    notes,
    // Visit proof
    visitPhotoUrl,         // photo from site
    visitDate,
  } = body;

  const metadata = {
    propertiesShown:      propertiesShown || [],
    clientInterest:       clientInterest || "WARM",
    clientFeedback:       clientFeedback || "",
    budgetConfirmed:      budgetConfirmed || null,
    requirementConfirmed: requirementConfirmed || "",
    locationConfirmed:    locationConfirmed ?? false,
    locationNotes:        locationNotes || "",
    nextStep:             nextStep || "FOLLOW_UP",
    nextFollowUpDate:     nextFollowUpDate || null,
    notes:                notes || "",
    visitPhotoUrl:        visitPhotoUrl || null,
    visitDate:            visitDate || new Date().toISOString(),
    submittedBy:          user.name,
    submittedById:        user.id,
  };

  // Save as activity
  const activity = await prisma.activity.create({
    data: {
      type:        "VISIT_REPORT",
      description: `Visit report by ${user.name}: ${propertiesShown?.length || 0} properties shown. Client interest: ${clientInterest || "WARM"}. Next: ${nextStep || "FOLLOW_UP"}`,
      metadata:    metadata as any,
      leadId:      params.id,
      userId:      user.id,
    },
    include: { user: { select: { id: true, name: true, avatar: true } } },
  });

  // ── Auto-update lead based on visit report logic ──
  const autoStatus =
    nextStep === "NOT_INTERESTED" ? "LOST" :
    nextStep === "DEAL_CLOSED"    ? "DEAL_CLOSED" :
    nextStep === "NEGOTIATION"    ? "NEGOTIATION" :
    nextStep === "ANOTHER_VISIT"  ? "SITE_VISIT_SCHEDULED" :
    clientInterest === "HOT"      ? "NEGOTIATION" :
    "CONTACTED";

  // Auto follow-up: if not set, derive from nextStep
  let autoFollowUp: Date | null = nextFollowUpDate ? new Date(nextFollowUpDate) : null;
  if (!autoFollowUp && nextStep === "FOLLOW_UP") {
    autoFollowUp = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000); // +2 days
  } else if (!autoFollowUp && nextStep === "ANOTHER_VISIT") {
    autoFollowUp = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // +3 days
  } else if (!autoFollowUp && clientInterest === "HOT") {
    autoFollowUp = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000); // +1 day
  }

  const updatedLead = await prisma.lead.update({
    where: { id: params.id },
    data: {
      status:          autoStatus as any,
      lastContactedAt: new Date(),
      ...(autoFollowUp && { nextFollowUpAt: autoFollowUp }),
      // Update budget if confirmed in visit
      ...(budgetConfirmed && { budget: Number(budgetConfirmed) }),
      // Update requirements if confirmed
      ...(requirementConfirmed && { requirements: requirementConfirmed }),
    },
  });

  // ── Auto-create follow-up task if nextStep needs it ──
  if (autoFollowUp && nextStep !== "DEAL_CLOSED" && nextStep !== "NOT_INTERESTED") {
    const taskTitle =
      nextStep === "ANOTHER_VISIT"  ? `Site visit #2 — ${lead.name}` :
      nextStep === "NEGOTIATION"    ? `Negotiation follow-up — ${lead.name}` :
      nextStep === "FOLLOW_UP"      ? `Follow up call — ${lead.name}` :
                                      `Follow up — ${lead.name}`;
    await prisma.task.create({
      data: {
        leadId:      params.id,
        title:       taskTitle,
        description: `Auto-created from visit report by ${user.name}. Interest: ${clientInterest}. Properties shown: ${propertiesShown?.map((p: any) => p.propertyName || p.locality).filter(Boolean).join(", ") || "N/A"}`,
        dueAt:       autoFollowUp,
        priority:    clientInterest === "HOT" ? "HIGH" : clientInterest === "WARM" ? "MEDIUM" : "LOW",
        assignedToId: user.id,
      },
    }).catch(() => {});
  }

  // ── Notify all admins in DB ──
  const adminIds = await prisma.user.findMany({
    where: { role: "ADMIN" as any, isActive: true },
    select: { id: true },
  });
  await Promise.all(adminIds.map(a =>
    prisma.notification.create({
      data: {
        userId:  a.id,
        type:    "LEAD_ASSIGNED" as any,
        title:   `Visit Report: ${lead.name} — ${user.name}`,
        message: `${user.name} visited ${lead.name}. Interest: ${clientInterest}. Properties: ${propertiesShown?.length || 0}. Next: ${nextStep}. Status → ${autoStatus}`,
        leadId:  params.id,
      },
    }).catch(() => {})
  ));

  // Notify admin via email
  const propList = (propertiesShown || []).map((p: any) =>
    `<li><b>${p.propertyName || "Property"}</b> — ${p.locality || ""}${p.ownerName ? ` | Owner: ${p.ownerName} (${p.ownerPhone || ""})` : ""}${p.price ? ` | ₹${Number(p.price).toLocaleString("en-IN")}` : ""}</li>`
  ).join("");

  sendAdminEmail(
    `Visit Report: ${lead.name} — by ${user.name}`,
    `<div style="font-family:sans-serif;max-width:600px">
      <h2 style="color:#f59e0b">📋 Visit Report Submitted</h2>
      <p><b>Lead:</b> ${lead.name} (${lead.phone})</p>
      <p><b>Employee:</b> ${user.name}</p>
      <p><b>Visit Date:</b> ${visitDate || new Date().toLocaleDateString("en-IN")}</p>
      <hr/>
      <h3>🏠 Properties Shown (${propertiesShown?.length || 0})</h3>
      ${propList ? `<ul>${propList}</ul>` : "<p>None recorded</p>"}
      <h3>👤 Client Feedback</h3>
      <p><b>Interest Level:</b> <span style="color:${clientInterest === "HOT" ? "#ef4444" : clientInterest === "WARM" ? "#f97316" : "#3b82f6"}">${clientInterest || "WARM"}</span></p>
      <p><b>Budget Confirmed:</b> ${budgetConfirmed ? `₹${Number(budgetConfirmed).toLocaleString("en-IN")}` : "Not confirmed"}</p>
      <p><b>Location Confirmed:</b> ${locationConfirmed ? "✅ Yes" : "❌ No"} ${locationNotes ? `— ${locationNotes}` : ""}</p>
      <p><b>Requirements:</b> ${requirementConfirmed || lead.requirements || "—"}</p>
      <p><b>Feedback:</b> ${clientFeedback || "—"}</p>
      <h3>📅 Next Steps</h3>
      <p><b>Action:</b> ${nextStep || "FOLLOW_UP"}</p>
      <p><b>Follow-up Date:</b> ${nextFollowUpDate ? new Date(nextFollowUpDate).toLocaleDateString("en-IN") : "—"}</p>
      <p><b>Notes:</b> ${notes || "—"}</p>
      ${visitPhotoUrl ? `<h3>📸 Visit Photo</h3><img src="${visitPhotoUrl}" style="max-width:400px;border-radius:8px"/>` : ""}
    </div>`
  ).catch(() => {});

  return NextResponse.json({ activity, lead: updatedLead }, { status: 201 });
}

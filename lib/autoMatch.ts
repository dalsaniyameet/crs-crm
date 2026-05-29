import { prisma } from "@/lib/prisma";

/**
 * Real Estate Match Scoring — Rule-based (no AI dependency)
 *
 * Scoring breakdown (total 100):
 *  - Property Type match      : 25 pts
 *  - Transaction Type match   : 20 pts
 *  - Budget fit               : 25 pts  (exact=25, ±10%=20, ±20%=12, ±30%=5)
 *  - Locality / Area match    : 15 pts
 *  - Area (sqft) match        : 10 pts
 *  - Status = AVAILABLE       :  5 pts  (bonus)
 */
function scoreMatch(lead: any, property: any): number {
  let score = 0;

  // 1. Property type (25 pts)
  if (lead.propertyType && property.type === lead.propertyType) score += 25;

  // 2. Transaction type (20 pts)
  if (lead.transactionType && property.transactionType === lead.transactionType) score += 20;

  // 3. Budget fit (25 pts)
  if (lead.budget && property.price) {
    const budget = lead.budget;
    const price  = property.price;
    const diff   = Math.abs(price - budget) / budget;
    if (diff <= 0.05)      score += 25; // within 5%
    else if (diff <= 0.10) score += 20; // within 10%
    else if (diff <= 0.20) score += 12; // within 20%
    else if (diff <= 0.30) score +=  5; // within 30%
    // above 30% = 0 pts but still include if other factors match
  } else if (!lead.budget) {
    score += 12; // no budget specified — partial credit
  }

  // 4. Locality match (15 pts)
  if (lead.preferredAreas?.length > 0 && property.locality) {
    const loc = property.locality.toLowerCase();
    const matched = lead.preferredAreas.some((area: string) =>
      loc.includes(area.toLowerCase()) || area.toLowerCase().includes(loc)
    );
    if (matched) score += 15;
  } else if (lead.requirements && property.locality) {
    // Try to find locality mention in requirements text
    const req = lead.requirements.toLowerCase();
    const loc = property.locality.toLowerCase();
    if (req.includes(loc)) score += 10;
  }

  // 5. Area / sqft match (10 pts)
  if (lead.requirements && property.area) {
    // Extract sqft numbers from requirements text
    const sqftMatch = lead.requirements.match(/(\d[\d,]*)\s*(?:sq\.?ft|sqft|sft|sq ft)/i);
    if (sqftMatch) {
      const reqArea = parseFloat(sqftMatch[1].replace(/,/g, ""));
      const diff    = Math.abs(property.area - reqArea) / reqArea;
      if (diff <= 0.10)      score += 10;
      else if (diff <= 0.25) score +=  6;
      else if (diff <= 0.40) score +=  3;
    }
  }

  // 6. Available status bonus (5 pts)
  if (property.status === "AVAILABLE") score += 5;

  return Math.min(score, 100);
}

export async function autoMatchProperties(leadId: string) {
  try {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
    });
    if (!lead) return;

    // Build property filter — broad enough to get candidates
    const where: Record<string, any> = {
      status: { in: ["AVAILABLE", "UNDER_NEGOTIATION"] },
    };
    if (lead.propertyType)    where.type            = lead.propertyType;
    if (lead.transactionType) where.transactionType = lead.transactionType;
    if (lead.budget)          where.price           = { lte: lead.budget * 1.35 }; // 35% buffer

    const properties = await prisma.property.findMany({
      where,
      select: {
        id: true, title: true, price: true, area: true,
        locality: true, type: true, transactionType: true, status: true,
      },
      take: 50,
    });

    if (properties.length === 0) return;

    // Score all properties
    const scored = properties
      .map(p => ({ propertyId: p.id, property: p, score: scoreMatch(lead, p) }))
      .filter(m => m.score >= 30) // minimum threshold
      .sort((a, b) => b.score - a.score)
      .slice(0, 10); // top 10

    if (scored.length === 0) return;

    // Save matches
    for (const m of scored) {
      await prisma.propertyMatch.upsert({
        where:  { leadId_propertyId: { leadId, propertyId: m.propertyId } },
        update: { score: m.score },
        create: { leadId, propertyId: m.propertyId, score: m.score },
      });
    }

    // Notify broker / admins about top match
    const top = scored[0];
    const notifyUsers: string[] = [];

    if (lead.assignedToId) {
      notifyUsers.push(lead.assignedToId);
    } else {
      const admins = await prisma.user.findMany({
        where: { role: { in: ["ADMIN", "SALES_MANAGER"] }, isActive: true },
        select: { id: true },
      });
      admins.forEach(a => notifyUsers.push(a.id));
    }

    await Promise.all(
      notifyUsers.map(uid =>
        prisma.notification.create({
          data: {
            type:    "PROPERTY_MATCH",
            title:   `🏠 ${scored.length} Properties Matched — ${lead.name}`,
            message: `Top match: "${top.property.title}" in ${top.property.locality} (Score: ${top.score}%)`,
            userId:  uid,
            leadId,
            metadata: {
              matchCount:      scored.length,
              topPropertyId:   top.propertyId,
              topPropertyName: top.property.title,
              topScore:        top.score,
            },
          },
        }).catch(() => {})
      )
    );

    // Boost lead score if strong match found
    if (top.score >= 75 && lead.score < 70) {
      await prisma.lead.update({
        where: { id: leadId },
        data:  { score: Math.min(100, lead.score + 15) },
      });
    }
  } catch (err: any) {
    console.error("autoMatchProperties error:", err.message);
  }
}

// ── Reverse: new property → match against active leads ──────────────────────
export async function autoMatchLeadsForProperty(propertyId: string) {
  try {
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: {
        id: true, title: true, price: true, area: true,
        locality: true, type: true, transactionType: true, status: true,
      },
    });
    if (!property || !["AVAILABLE", "UNDER_NEGOTIATION"].includes(property.status)) return;

    const leadsWhere: Record<string, any> = {
      status: { notIn: ["DEAL_CLOSED", "LOST"] },
    };
    if (property.type)            leadsWhere.propertyType    = property.type;
    if (property.transactionType) leadsWhere.transactionType = property.transactionType;
    if (property.price)           leadsWhere.budget          = { gte: property.price * 0.65 };

    const leads = await prisma.lead.findMany({
      where: leadsWhere,
      select: {
        id: true, name: true, budget: true, requirements: true,
        propertyType: true, transactionType: true, preferredAreas: true,
        score: true, assignedToId: true,
      },
      take: 50,
    });

    if (leads.length === 0) return;

    const admins = await prisma.user.findMany({
      where: { role: { in: ["ADMIN", "SALES_MANAGER"] }, isActive: true },
      select: { id: true },
    });

    for (const lead of leads) {
      const score = scoreMatch(lead, property);
      if (score < 30) continue;

      await prisma.propertyMatch.upsert({
        where:  { leadId_propertyId: { leadId: lead.id, propertyId } },
        update: { score },
        create: { leadId: lead.id, propertyId, score },
      });

      const notifyUsers = lead.assignedToId
        ? [lead.assignedToId]
        : admins.map(a => a.id);

      await Promise.all(notifyUsers.map(uid =>
        prisma.notification.create({
          data: {
            type:    "PROPERTY_MATCH",
            title:   `🏢 New Property Matches Lead — ${lead.name}`,
            message: `"${property.title}" in ${property.locality} matches ${lead.name}'s requirement (Score: ${score}%)`,
            userId:  uid,
            leadId:  lead.id,
            metadata: { propertyId, propertyName: property.title, score },
          },
        }).catch(() => {})
      ));
    }
  } catch (err: any) {
    console.error("autoMatchLeadsForProperty error:", err.message);
  }
}

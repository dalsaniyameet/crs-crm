import { prisma } from "@/lib/prisma";

/**
 * Real Estate Match Scoring — Strict Rule-Based Logic
 *
 * Total: 100 pts — minimum 55 to qualify as a match
 *
 * Property Type   : 30 pts  (HARD — must match, else 0)
 * Transaction Type: 25 pts  (HARD — must match, else 0)
 * Budget fit      : 25 pts  (within 10% = 25, 20% = 15, 30% = 5, >30% = 0)
 * Locality match  : 15 pts  (exact area = 15, city/nearby = 8)
 * Area/sqft match : 5 pts   (bonus if mentioned in requirements)
 */
function scoreMatch(lead: any, property: any): number {
  // ── 1. HARD: Property Type (30 pts) ──────────────────────────────────────
  // If lead has specified type, it MUST match
  if (lead.propertyType) {
    if (property.type !== lead.propertyType) return 0; // hard reject
  }

  // ── 2. HARD: Transaction Type (25 pts) ───────────────────────────────────
  // Real estate: owner SELL → client BUY, RENT → RENT/LEASE
  if (lead.transactionType && property.transactionType) {
    const txnCompatible =
      (lead.transactionType === "BUY"   && (property.transactionType === "SELL" || property.transactionType === "BUY")) ||
      (lead.transactionType === "SELL"  && (property.transactionType === "BUY"  || property.transactionType === "SELL")) ||
      (lead.transactionType === "RENT"  && (property.transactionType === "RENT" || property.transactionType === "LEASE")) ||
      (lead.transactionType === "LEASE" && (property.transactionType === "LEASE"|| property.transactionType === "RENT"));
    if (!txnCompatible) return 0; // hard reject — wrong transaction type
  }

  let score = 30; // property type matched (or not specified)
  if (lead.propertyType && property.type === lead.propertyType) score = 30;
  else if (!lead.propertyType) score = 15; // partial — no type specified

  if (lead.transactionType && property.transactionType) score += 25;
  else if (!lead.transactionType) score += 12; // no txn specified

  // ── 3. Budget fit (25 pts) ───────────────────────────────────────────────
  if (lead.budget && property.price) {
    // Normalize budget — if stored in lakhs (< 1000) convert to actual
    const budget = lead.budget < 1000 ? lead.budget * 100000 : lead.budget;
    const price  = property.price;
    const ratio  = price / budget;

    if (ratio >= 0.70 && ratio <= 1.10) {
      score += 25; // within -30% to +10% of budget = excellent
    } else if (ratio >= 0.50 && ratio <= 1.20) {
      score += 15; // within -50% to +20% = good
    } else if (ratio >= 0.30 && ratio <= 1.30) {
      score += 5;  // stretch
    } else {
      return 0; // price way off — hard reject
    }
  } else if (!lead.budget) {
    score += 12; // no budget — partial credit
  } else {
    // property has no price — can still match on other factors
    score += 8;
  }

  // ── 4. Locality / Area match (15 pts) ────────────────────────────────────
  const propLocality = (property.locality || "").toLowerCase().trim();
  const propCity     = (property.city     || "").toLowerCase().trim();

  // Check preferred areas first
  if (lead.preferredAreas?.length > 0) {
    const exactMatch = lead.preferredAreas.some((area: string) => {
      const a = area.toLowerCase().trim();
      return propLocality.includes(a) || a.includes(propLocality) ||
             propLocality === a;
    });
    if (exactMatch) {
      score += 15;
    } else {
      // No locality match when client specified areas → penalty
      score -= 5;
    }
  } else if (lead.requirements && propLocality) {
    // Try to find locality in requirements text
    const req = lead.requirements.toLowerCase();
    if (req.includes(propLocality)) {
      score += 15;
    } else {
      // Check if any word from locality appears in requirements
      const locWords = propLocality.split(/[\s,]+/).filter((w: string) => w.length > 3);
      const partialMatch = locWords.some((w: string) => req.includes(w));
      if (partialMatch) score += 8;
    }
  } else if (!lead.preferredAreas?.length && !lead.requirements) {
    score += 8; // no preference specified — partial
  }

  // ── 5. Area / sqft match (5 pts bonus) ───────────────────────────────────
  if (lead.requirements && property.area) {
    const sqftMatch = lead.requirements.match(/(\d[\d,]*)\s*(?:sq\.?ft|sqft|sft|sq ft)/i);
    if (sqftMatch) {
      const reqArea = parseFloat(sqftMatch[1].replace(/,/g, ""));
      const ratio   = property.area / reqArea;
      if (ratio >= 0.85 && ratio <= 1.20) score += 5;
      else if (ratio >= 0.65 && ratio <= 1.40) score += 2;
    }
  }

  // ── 6. Property must be AVAILABLE ────────────────────────────────────────
  if (property.status !== "AVAILABLE" && property.status !== "UNDER_NEGOTIATION") {
    return 0; // not available — don't show
  }

  return Math.min(Math.max(score, 0), 100);
}

export async function autoMatchProperties(leadId: string) {
  try {
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) return;

    // Build strict property filter
    const where: Record<string, any> = {
      status: { in: ["AVAILABLE", "UNDER_NEGOTIATION"] },
    };

    // MUST match property type if specified
    if (lead.propertyType) where.type = lead.propertyType;

    // MUST match transaction type if specified (with real estate logic)
    if (lead.transactionType) {
      const txnFilter: string[] = [];
      if (lead.transactionType === "BUY")   txnFilter.push("SELL", "BUY");
      if (lead.transactionType === "SELL")  txnFilter.push("BUY",  "SELL");
      if (lead.transactionType === "RENT")  txnFilter.push("RENT", "LEASE");
      if (lead.transactionType === "LEASE") txnFilter.push("LEASE","RENT");
      if (txnFilter.length) where.transactionType = { in: txnFilter };
    }

    // Budget filter — only fetch properties within 30% of budget
    if (lead.budget) {
      const budget = lead.budget < 1000 ? lead.budget * 100000 : lead.budget;
      where.price = { gte: budget * 0.30, lte: budget * 1.30 };
    }

    const properties = await prisma.property.findMany({
      where,
      select: {
        id: true, title: true, price: true, area: true,
        locality: true, city: true, type: true,
        transactionType: true, status: true,
      },
      take: 100,
    });

    if (properties.length === 0) {
      // Widen search if no results — drop budget constraint
      const wideWhere: Record<string, any> = {
        status: { in: ["AVAILABLE", "UNDER_NEGOTIATION"] },
      };
      if (lead.propertyType) wideWhere.type = lead.propertyType;
      if (lead.transactionType) {
        const txnFilter: string[] = [];
        if (lead.transactionType === "BUY")   txnFilter.push("SELL", "BUY");
        if (lead.transactionType === "SELL")  txnFilter.push("BUY",  "SELL");
        if (lead.transactionType === "RENT")  txnFilter.push("RENT", "LEASE");
        if (lead.transactionType === "LEASE") txnFilter.push("LEASE","RENT");
        if (txnFilter.length) wideWhere.transactionType = { in: txnFilter };
      }
      const wideProps = await prisma.property.findMany({ where: wideWhere, select: { id: true, title: true, price: true, area: true, locality: true, city: true, type: true, transactionType: true, status: true }, take: 50 });
      if (wideProps.length === 0) return;
      properties.push(...wideProps);
    }

    // Score and filter — minimum 55 for a real match
    const scored = properties
      .map(p => ({ propertyId: p.id, property: p, score: scoreMatch(lead, p) }))
      .filter(m => m.score >= 55)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8); // max 8 matches

    if (scored.length === 0) return;

    // Delete old weak matches, save new ones
    await prisma.propertyMatch.deleteMany({ where: { leadId } });

    for (const m of scored) {
      await prisma.propertyMatch.create({
        data: { leadId, propertyId: m.propertyId, score: m.score },
      });
    }

    // Notify about top match
    const top = scored[0];
    const notifyUsers: string[] = [];
    if (lead.assignedToId) {
      notifyUsers.push(lead.assignedToId);
    } else {
      const admins = await prisma.user.findMany({
        where: { role: { in: ["ADMIN" as any, "SALES_MANAGER" as any] }, isActive: true },
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
            message: `Top match: "${top.property.title}" in ${top.property.locality} (${top.score}% match)`,
            userId:  uid,
            leadId,
            metadata: { matchCount: scored.length, topPropertyId: top.propertyId, topPropertyName: top.property.title, topScore: top.score },
          },
        }).catch(() => {})
      )
    );

    // Boost lead score if strong match found
    if (top.score >= 75 && lead.score < 70) {
      await prisma.lead.update({ where: { id: leadId }, data: { score: Math.min(100, lead.score + 15) } });
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
      select: { id: true, title: true, price: true, area: true, locality: true, city: true, type: true, transactionType: true, status: true },
    });
    if (!property || !["AVAILABLE", "UNDER_NEGOTIATION"].includes(property.status)) return;

    // Map property txn to lead txn
    const leadTxnFilter: string[] = [];
    if (property.transactionType === "SELL")  leadTxnFilter.push("BUY",  "SELL");
    if (property.transactionType === "BUY")   leadTxnFilter.push("SELL", "BUY");
    if (property.transactionType === "RENT")  leadTxnFilter.push("RENT", "LEASE");
    if (property.transactionType === "LEASE") leadTxnFilter.push("LEASE","RENT");

    const leadsWhere: Record<string, any> = {
      status: { notIn: ["DEAL_CLOSED", "LOST"] },
    };
    leadsWhere.propertyType    = property.type;
    if (leadTxnFilter.length)  leadsWhere.transactionType = { in: leadTxnFilter };
    if (property.price)        leadsWhere.budget = { gte: property.price * 0.30 };

    const leads = await prisma.lead.findMany({
      where: leadsWhere,
      select: { id: true, name: true, budget: true, requirements: true, propertyType: true, transactionType: true, preferredAreas: true, score: true, assignedToId: true },
      take: 50,
    });

    if (leads.length === 0) return;

    const admins = await prisma.user.findMany({
      where: { role: { in: ["ADMIN" as any, "SALES_MANAGER" as any] }, isActive: true },
      select: { id: true },
    });

    for (const lead of leads) {
      const score = scoreMatch(lead, property);
      if (score < 55) continue;

      await prisma.propertyMatch.upsert({
        where:  { leadId_propertyId: { leadId: lead.id, propertyId } },
        update: { score },
        create: { leadId: lead.id, propertyId, score },
      });

      const notifyUsers = lead.assignedToId ? [lead.assignedToId] : admins.map(a => a.id);
      await Promise.all(notifyUsers.map(uid =>
        prisma.notification.create({
          data: {
            type:    "PROPERTY_MATCH",
            title:   `🏢 New Property Matches Lead — ${lead.name}`,
            message: `"${property.title}" in ${property.locality} matches ${lead.name}'s requirement (${score}% match)`,
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

import { prisma } from "@/lib/prisma";
import { matchPropertiesAI } from "@/lib/openai";

export async function autoMatchProperties(leadId: string) {
  try {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: { assignedTo: true },
    });
    if (!lead || !lead.requirements) return;

    // Fetch available properties filtered by lead's type/transaction
    const where: Record<string, any> = { status: "AVAILABLE" };
    if (lead.propertyType)    where.type            = lead.propertyType;
    if (lead.transactionType) where.transactionType = lead.transactionType;
    if (lead.budget)          where.price           = { lte: lead.budget * 1.2 }; // 20% buffer

    const properties = await prisma.property.findMany({
      where,
      select: { id: true, title: true, price: true, area: true, locality: true, type: true },
      take: 20,
    });

    if (properties.length === 0) return;

    // AI match
    const matches = await matchPropertiesAI(lead.requirements, properties);
    if (!matches.length) return;

    // Save matches (upsert to avoid duplicates)
    for (const m of matches) {
      await prisma.propertyMatch.upsert({
        where:  { leadId_propertyId: { leadId, propertyId: m.propertyId } },
        update: { score: m.score },
        create: { leadId, propertyId: m.propertyId, score: m.score },
      });
    }

    // Get top match for notification
    const top = matches.sort((a, b) => b.score - a.score)[0];
    const topProperty = properties.find(p => p.id === top.propertyId);
    if (!topProperty) return;

    // Notify assigned broker (or all admins if unassigned)
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
            title:   `🏠 Property Match Found — ${lead.name}`,
            message: `${matches.length} propert${matches.length > 1 ? "ies" : "y"} matched! Top: "${topProperty.title}" in ${topProperty.locality} (Match Score: ${top.score}%)`,
            userId:  uid,
            leadId,
            metadata: {
              matchCount:      matches.length,
              topPropertyId:   top.propertyId,
              topPropertyName: topProperty.title,
              topScore:        top.score,
            },
          },
        })
      )
    );

    // Update lead score boost if high match found
    if (top.score >= 80 && lead.score < 70) {
      await prisma.lead.update({
        where: { id: leadId },
        data:  { score: Math.min(100, lead.score + 15) },
      });
    }
  } catch (err: any) {
    console.error("Auto-match error:", err.message);
  }
}

// ── Reverse: new property added → match against existing active leads ──
export async function autoMatchLeadsForProperty(propertyId: string) {
  try {
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: { id: true, title: true, price: true, area: true, locality: true, type: true, transactionType: true, status: true },
    });
    if (!property || property.status !== "AVAILABLE") return;

    // Find active leads that could match this property
    const leadsWhere: Record<string, any> = {
      status: { notIn: ["DEAL_CLOSED", "LOST"] },
      requirements: { not: null },
    };
    if (property.type)            leadsWhere.propertyType    = property.type;
    if (property.transactionType) leadsWhere.transactionType = property.transactionType;
    if (property.price)           leadsWhere.budget          = { gte: property.price * 0.7 }; // lead budget >= 70% of price

    const leads = await prisma.lead.findMany({
      where: leadsWhere,
      select: { id: true, name: true, requirements: true, score: true, assignedToId: true },
      take: 30,
    });

    if (leads.length === 0) return;

    // For each lead, run AI match against this single property
    const admins = await prisma.user.findMany({
      where: { role: { in: ["ADMIN", "SALES_MANAGER"] }, isActive: true },
      select: { id: true },
    });

    for (const lead of leads) {
      if (!lead.requirements) continue;
      try {
        const matches = await matchPropertiesAI(lead.requirements, [property]);
        if (!matches.length || matches[0].score < 50) continue;

        const score = matches[0].score;
        await prisma.propertyMatch.upsert({
          where:  { leadId_propertyId: { leadId: lead.id, propertyId } },
          update: { score },
          create: { leadId: lead.id, propertyId, score },
        });

        // Notify broker or admins
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
          })
        ));
      } catch { /* skip individual lead errors */ }
    }
  } catch (err: any) {
    console.error("autoMatchLeadsForProperty error:", err.message);
  }
}

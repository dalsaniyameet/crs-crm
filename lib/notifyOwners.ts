import { prisma } from "@/lib/prisma";
import { sendWhatsApp } from "@/lib/whatsapp";

export async function notifyMatchingOwners(leadId: string) {
  try {
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) return;

    // Only notify if lead has enough info
    if (!lead.propertyType && !lead.transactionType && !lead.budget) return;

    const propertyWhere: Record<string, any> = {
      ownerId:  { not: null },
      status:   { in: ["AVAILABLE", "UNDER_NEGOTIATION"] },
    };
    if (lead.propertyType)    propertyWhere.type            = lead.propertyType;
    if (lead.transactionType) propertyWhere.transactionType = lead.transactionType;
    if (lead.budget)          propertyWhere.price           = { lte: lead.budget * 1.4 };

    // Preferred area filter
    if (lead.preferredAreas?.length > 0) {
      propertyWhere.locality = {
        in: lead.preferredAreas,
        mode: "insensitive",
      };
    }

    const properties = await prisma.property.findMany({
      where:  propertyWhere,
      select: { ownerId: true, title: true, price: true, locality: true },
      take:   100,
    });

    const ownerIds = [...new Set(properties.map(p => p.ownerId).filter(Boolean))] as string[];
    if (ownerIds.length === 0) return;

    // Check already notified in last 7 days for same lead type
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentlyNotified = await prisma.ownerMessage.findMany({
      where: {
        ownerId:   { in: ownerIds },
        direction: "OUT",
        createdAt: { gte: sevenDaysAgo },
        message:   { contains: lead.propertyType || "property" },
      },
      select: { ownerId: true },
    });
    const alreadyNotified = new Set(recentlyNotified.map(m => m.ownerId));
    const freshOwnerIds   = ownerIds.filter(id => !alreadyNotified.has(id)).slice(0, 20);
    if (freshOwnerIds.length === 0) return;

    const owners = await prisma.propertyOwner.findMany({
      where:  { id: { in: freshOwnerIds }, isActive: true },
      select: { id: true, name: true, phone: true },
    });
    if (owners.length === 0) return;

    const isResidential = lead.category === "RESIDENTIAL" || !lead.category;
    const budgetStr = lead.budget
      ? lead.budget >= 10000000
        ? `₹${(lead.budget / 10000000).toFixed(1)} Cr`
        : lead.budget >= 100000
        ? `₹${(lead.budget / 100000).toFixed(1)} L`
        : `₹${lead.budget.toLocaleString("en-IN")}`
      : "Negotiable";

    const propTypeStr = lead.propertyType?.replace(/_/g, " ") || (isResidential ? "Residential" : "Commercial");
    const areasStr    = lead.preferredAreas?.length > 0
      ? lead.preferredAreas.join(", ")
      : "Ahmedabad";
    const txStr = lead.transactionType === "RENT" ? "Rent"
      : lead.transactionType === "LEASE" ? "Lease"
      : lead.transactionType === "BUY"   ? "Buy"   : "Sell";

    const msg =
      `⚜️ *CITY REAL SPACE*\n` +
      `📞 Ahmedabad | +91 98250 31247\n\n` +
      `Hello {NAME} ji! 🙏\n\n` +
      `*We have a serious client requirement:*\n\n` +
      `🏠 *Type:* ${propTypeStr}\n` +
      `🔑 *Looking to:* ${txStr}\n` +
      `📍 *Preferred Area:* ${areasStr}\n` +
      `💰 *Budget:* ${budgetStr}\n` +
      (lead.requirements ? `📝 *Requirements:* ${lead.requirements}\n` : "") +
      `\n` +
      `If your property matches, please share details.\n` +
      `We handle everything — documentation, visits, deal closure.\n\n` +
      `📞 City Real Space\n` +
      `🏢 Prahlad Nagar Trade Centre, Satellite, Ahmedabad\n` +
      `🌐 cityrealspace.com`;

    await Promise.all(
      owners.map(async (owner) => {
        const personalMsg = msg.replace("{NAME}", owner.name);
        try {
          await sendWhatsApp(owner.phone, personalMsg);
        } catch { /* non-critical */ }
        await prisma.ownerMessage.create({
          data: { ownerId: owner.id, direction: "OUT", message: personalMsg },
        }).catch(() => {});
      })
    );

    console.log(`[notifyOwners] Sent to ${owners.length} owners for lead ${leadId}`);
  } catch (err: any) {
    console.error("[notifyOwners] Error:", err.message);
  }
}

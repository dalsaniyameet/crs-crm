import { prisma } from "@/lib/prisma";
import { sendWhatsApp } from "@/lib/whatsapp";

export async function notifyMatchingOwners(leadId: string) {
  try {
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) return;

    // Build filter to find matching owners via their properties
    const propertyWhere: Record<string, any> = { ownerId: { not: null } };
    if (lead.propertyType)    propertyWhere.type            = lead.propertyType;
    if (lead.transactionType) propertyWhere.transactionType = lead.transactionType;
    if (lead.budget)          propertyWhere.price           = { lte: lead.budget * 1.3 };

    // Get up to 50 unique owners with matching properties
    const properties = await prisma.property.findMany({
      where:   propertyWhere,
      select:  { ownerId: true, title: true, price: true, locality: true },
      take:    100,
    });

    // Deduplicate owners, max 50
    const ownerIds = [...new Set(properties.map(p => p.ownerId).filter(Boolean))] as string[];
    const top50 = ownerIds.slice(0, 50);

    if (top50.length === 0) return;

    const owners = await prisma.propertyOwner.findMany({
      where: { id: { in: top50 }, isActive: true },
      select: { id: true, name: true, phone: true },
    });

    const budget = lead.budget
      ? `₹${lead.budget.toLocaleString("en-IN")}`
      : "negotiable";

    const msg =
      `🏢 *New Client Requirement — City Real Space*\n\n` +
      `Hi {NAME},\n\n` +
      `We have a serious buyer/tenant looking for:\n` +
      `• *Type:* ${lead.propertyType || "Any"}\n` +
      `• *Transaction:* ${lead.transactionType || "Any"}\n` +
      `• *Budget:* ${budget}\n` +
      `• *Requirements:* ${lead.requirements || "—"}\n\n` +
      `If you have a matching property, please reply on this number.\n\n` +
      `📞 City Real Space | Ahmedabad`;

    // Send WP to each owner & save message log
    await Promise.all(
      owners.map(async (owner) => {
        const personalMsg = msg.replace("{NAME}", owner.name);
        await sendWhatsApp(owner.phone, personalMsg);
        await prisma.ownerMessage.create({
          data: {
            ownerId:   owner.id,
            direction: "OUT",
            message:   personalMsg,
          },
        });
      })
    );

    console.log(`[notifyOwners] Sent to ${owners.length} owners for lead ${leadId}`);
  } catch (err: any) {
    console.error("[notifyOwners] Error:", err.message);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { propertyId } = await req.json();

    const property = await prisma.property.findUnique({ where: { id: propertyId } });
    if (!property) return NextResponse.json({ error: "Property not found" }, { status: 404 });

    // Find leads matching category, transactionType, and budget range
    const leads = await prisma.lead.findMany({
      where: {
        status: { notIn: ["DEAL_CLOSED", "LOST"] },
        category: property.category,
        transactionType: property.transactionType,
        OR: [
          { budget: null },
          { budget: { gte: property.price * 0.7, lte: property.price * 1.3 } },
          { budgetMax: { gte: property.price * 0.7 } },
        ],
      },
      select: { id: true, name: true, phone: true, budget: true, budgetMax: true, transactionType: true, preferredAreas: true, status: true },
      take: 10,
    });

    // Score each lead
    const scored = leads.map(lead => {
      let score = 50;
      if (lead.budget && lead.budget <= property.price && (!lead.budgetMax || lead.budgetMax >= property.price)) score += 30;
      if (lead.preferredAreas?.some(a => property.locality.toLowerCase().includes(a.toLowerCase()))) score += 20;
      return { ...lead, matchScore: Math.min(score, 100) };
    }).sort((a, b) => b.matchScore - a.matchScore);

    // Upsert matches in DB
    await Promise.all(scored.map(lead =>
      prisma.propertyMatch.upsert({
        where: { leadId_propertyId: { leadId: lead.id, propertyId } },
        create: { leadId: lead.id, propertyId, score: lead.matchScore },
        update: { score: lead.matchScore },
      })
    ));

    return NextResponse.json({ matches: scored });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

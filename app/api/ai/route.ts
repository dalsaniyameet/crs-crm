import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  chatWithAssistant,
  generateFollowUpMessage,
  generatePropertyDescription,
  generateSocialPost,
  matchPropertiesAI,
  scoreLeadAI,
} from "@/lib/openai";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { action, message, context, leadId, property, lead } = await req.json();

  try {
    let response: unknown;

    switch (action) {
      case "chat":
        response = await chatWithAssistant(message, context ?? []);
        break;

      case "score_lead":
        response = await scoreLeadAI(lead);
        break;

      case "follow_up":
        response = await generateFollowUpMessage(lead);
        break;

      case "property_description":
        response = await generatePropertyDescription(property);
        break;

      case "social_post":
        response = await generateSocialPost(property);
        break;

      case "match_properties": {
        const properties = await prisma.property.findMany({
          where:  { status: "AVAILABLE" },
          select: { id: true, title: true, price: true, area: true, locality: true, type: true },
          take:   50,
        });
        const leadData = await prisma.lead.findUnique({ where: { id: leadId } });
        if (!leadData) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

        const matches = await matchPropertiesAI(
          leadData.requirements ??
            `${leadData.propertyType} in ${leadData.preferredAreas.join(", ")} under ₹${leadData.budgetMax}`,
          properties
        );

        for (const match of matches) {
          await prisma.propertyMatch.upsert({
            where:  { leadId_propertyId: { leadId: leadData.id, propertyId: match.propertyId } },
            update: { score: match.score },
            create: { leadId: leadData.id, propertyId: match.propertyId, score: match.score },
          });
        }
        response = matches;
        break;
      }

      default:
        response = await chatWithAssistant(message ?? "Hello", context ?? []);
    }

    await prisma.aILog.create({
      data: {
        type:     action ?? "chat",
        prompt:   message ?? action,
        response: typeof response === "string" ? response : JSON.stringify(response),
        model:    "gpt-4o-mini",
      },
    }).catch(() => {});

    return NextResponse.json({ response });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "AI service error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}


import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const MODEL = "llama-3.3-70b-versatile";

export async function scoreLeadAI(lead: {
  budget?: number | null;
  requirements?: string | null;
  source: string;
  propertyType?: string | null;
  transactionType?: string | null;
}): Promise<{ score: number; probability: number; reasoning: string }> {
  const prompt = `You are a real estate CRM AI for City Real Space, Ahmedabad.
Score this lead from 0-100 based on conversion potential.

Lead Data:
- Budget: ₹${lead.budget ? lead.budget.toLocaleString("en-IN") : "Not specified"}
- Requirements: ${lead.requirements || "Not specified"}
- Source: ${lead.source}
- Property Type: ${lead.propertyType || "Not specified"}
- Transaction: ${lead.transactionType || "Not specified"}

Return JSON only: { "score": number, "probability": number, "reasoning": "brief reason" }`;

  const res = await groq.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    max_tokens: 200,
  });

  return JSON.parse(res.choices[0].message.content || "{}");
}

export async function matchPropertiesAI(
  leadRequirements: string,
  properties: Array<{ id: string; title: string; price: number; area: number; locality: string; type: string }>
): Promise<Array<{ propertyId: string; score: number; reason: string }>> {
  const prompt = `Real estate AI for Ahmedabad. Match these properties to the lead requirement.

Lead Requirement: "${leadRequirements}"

Properties:
${properties.map((p, i) => `${i + 1}. ID:${p.id} | ${p.title} | ₹${p.price.toLocaleString("en-IN")} | ${p.area} sqft | ${p.locality} | ${p.type}`).join("\n")}

Return JSON only: { "matches": [{ "propertyId": "id", "score": 0-100, "reason": "brief" }] }
Only include properties with score > 50. Max 5 results.`;

  const res = await groq.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    max_tokens: 500,
  });

  const data = JSON.parse(res.choices[0].message.content || "{}");
  return data.matches || [];
}

export async function generateFollowUpMessage(lead: {
  name: string;
  requirements?: string | null;
  lastContactedAt?: Date | null;
  status: string;
}): Promise<string> {
  const res = await groq.chat.completions.create({
    model: MODEL,
    messages: [{
      role: "user",
      content: `Write a professional WhatsApp follow-up message for a real estate lead.
Broker company: City Real Space, Ahmedabad.
Lead: ${lead.name}
Requirements: ${lead.requirements || "property in Ahmedabad"}
Status: ${lead.status}
Write a short, friendly message in English. Max 3 sentences. Include a call to action.`,
    }],
    max_tokens: 150,
  });
  return res.choices[0].message.content || "";
}

export async function generatePropertyDescription(property: {
  title: string; type: string; area: number; price: number; locality: string; amenities: string[];
}): Promise<string> {
  const res = await groq.chat.completions.create({
    model: MODEL,
    messages: [{
      role: "user",
      content: `Write a compelling real estate property description for City Real Space, Ahmedabad.
Property: ${property.title} | ${property.type} | ${property.area} sqft | ₹${property.price.toLocaleString("en-IN")} | ${property.locality} | Amenities: ${property.amenities.join(", ")}
Write 2-3 engaging paragraphs. Professional tone.`,
    }],
    max_tokens: 300,
  });
  return res.choices[0].message.content || "";
}

export async function generateSocialPost(property: {
  title: string; type: string; price: number; locality: string; area: number;
}): Promise<{ instagram: string; whatsapp: string; facebook: string }> {
  const res = await groq.chat.completions.create({
    model: MODEL,
    messages: [{
      role: "user",
      content: `Create social media posts for this property by City Real Space, Ahmedabad.
Property: ${property.title} | ${property.type} | ₹${property.price.toLocaleString("en-IN")} | ${property.area} sqft | ${property.locality}
Return JSON: { "instagram": "caption with emojis and hashtags", "whatsapp": "broadcast message", "facebook": "post" }`,
    }],
    response_format: { type: "json_object" },
    max_tokens: 400,
  });
  return JSON.parse(res.choices[0].message.content || "{}");
}

export async function chatWithAssistant(
  message: string,
  context: { role: string; content: string }[]
): Promise<string> {
  const res = await groq.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: "system",
        content: `You are an AI assistant for City Real Space CRM, a real estate brokerage in Ahmedabad, Gujarat, India.
You help brokers with drafting client replies, property descriptions, lead analysis, market insights, WhatsApp templates, and commission calculations.
Be concise, professional, and helpful. Use Indian real estate terminology.`,
      },
      ...context.map(c => ({ role: c.role as "user" | "assistant", content: c.content })),
      { role: "user", content: message },
    ],
    max_tokens: 500,
  });
  return res.choices[0].message.content || "";
}

export default groq;

const WATI_API_URL = process.env.WATI_API_URL;
const WATI_API_KEY = process.env.WATI_API_KEY;

// ── Send plain text message via WATI ──
export async function sendWhatsApp(to: string, message: string, mediaUrl?: string) {
  const phone = to.replace(/\D/g, "").slice(-10);
  const wa = `91${phone}`;

  if (!WATI_API_URL || !WATI_API_KEY) {
    console.warn("WATI: API URL or Key not configured");
    return;
  }

  try {
    // If media, send as media message
    if (mediaUrl) {
      await fetch(`${WATI_API_URL}/api/v1/sendMediaMessage?whatsappNumber=${wa}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${WATI_API_KEY}`,
        },
        body: JSON.stringify({ caption: message, mediaUrl }),
      });
      return;
    }

    // Plain text
    await fetch(`${WATI_API_URL}/api/v1/sendSessionMessage/${wa}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${WATI_API_KEY}`,
      },
      body: JSON.stringify({ messageText: message }),
    });
  } catch (e) {
    console.error("WATI sendWhatsApp error:", e);
  }
}

// ── Send Template Message via WATI ──
export async function sendWatiTemplate(
  to: string,
  templateName: string,
  parameters: { name: string; value: string }[]
) {
  const phone = to.replace(/\D/g, "").slice(-10);
  const wa = `91${phone}`;

  if (!WATI_API_URL || !WATI_API_KEY) return;

  try {
    await fetch(`${WATI_API_URL}/api/v1/sendTemplateMessage?whatsappNumber=${wa}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${WATI_API_KEY}`,
      },
      body: JSON.stringify({ template_name: templateName, broadcast_name: templateName, parameters }),
    });
  } catch (e) {
    console.error("WATI template error:", e);
  }
}

// ── Bulk send to multiple numbers ──
export async function sendWatiBulk(
  numbers: string[],
  message: string,
  mediaUrl?: string
) {
  const results = await Promise.allSettled(
    numbers.map(n => sendWhatsApp(n, message, mediaUrl))
  );
  const failed = results.filter(r => r.status === "rejected").length;
  return { sent: numbers.length - failed, failed };
}

// ── CRS Property Platform Client Requirement Message ──────────────────────
export function buildCRSRequirementMessage(lead: {
  name: string;
  phone: string;
  category?: string | null;       // RESIDENTIAL | COMMERCIAL
  propertyType?: string | null;
  transactionType?: string | null;
  budget?: number | null;
  requirements?: string | null;
  preferredAreas?: string[];
  source?: string;
  assignedTo?: string | null;
}): string {
  const isResidential = !lead.category || lead.category === "RESIDENTIAL";
  const isCommercial  = lead.category === "COMMERCIAL";
  const isRental = lead.transactionType === "RENT" || lead.transactionType === "LEASE";

  const budgetStr = lead.budget
    ? lead.budget >= 10000000
      ? `₹${(lead.budget / 10000000).toFixed(1)} Cr`
      : lead.budget >= 100000
      ? `₹${(lead.budget / 100000).toFixed(1)} L`
      : `₹${lead.budget.toLocaleString("en-IN")}`
    : "Not specified";

  const areas = lead.preferredAreas?.length
    ? lead.preferredAreas.join(", ")
    : "Not specified";

  const propType = lead.propertyType
    ? lead.propertyType.replace(/_/g, " ")
    : isResidential ? "1 BHK / 2 BHK / 3 BHK" : "Office / Shop / Showroom / Godown";

  const txType = lead.transactionType
    ? lead.transactionType.charAt(0) + lead.transactionType.slice(1).toLowerCase()
    : "Buy / Sell / Rent";

  if (isResidential) {
    return `⚜️ *CITY REAL SPACE*
🏙️ Ahmedabad's Trusted Property Platform

📋 *CLIENT REQUIREMENT DETAILS*

👤 *Client Name:* ${lead.name}
📞 *Phone:* ${lead.phone}
📥 *Source:* ${lead.source?.replace(/_/g, " ") || "—"}

🏠 *Category:* RESIDENTIAL
🔑 *Transaction:* ${txType}
🏡 *Property Type:* ${propType}
${isRental ? `🛋️ *Furnished Status:* Semi Furnished / Fully Furnished / Unfurnished
` : ""}📍 *Preferred Area:* ${areas}
💰 *Budget:* ${budgetStr}
⏰ *Visit Time:* As per client convenience

📝 *Special Requirements:*
${lead.requirements || "—"}

📸 *Photo & Details:* Will be shared shortly

✅ _Our team will contact you soon with best matching properties._

🏢 *City Real Space*
📞 +91 98250 31247
🌐 cityrealspace.com`;
  }

  // COMMERCIAL
  return `⚜️ *CITY REAL SPACE*
🏙️ Ahmedabad's Trusted Property Platform

📋 *CLIENT REQUIREMENT DETAILS*

👤 *Client Name:* ${lead.name}
📞 *Phone:* ${lead.phone}
📥 *Source:* ${lead.source?.replace(/_/g, " ") || "—"}

🏢 *Category:* COMMERCIAL
🔑 *Transaction:* ${txType}
🏪 *Property Type:* ${propType}
${isRental ? `🛋️ *Furnished Status:* Furnished / Semi Furnished / Bare Shell
` : ""}📍 *Preferred Area:* ${areas}
💰 *Budget:* ${budgetStr}
⏰ *Visit Time:* As per client convenience

📝 *Special Requirements:*
${lead.requirements || "—"}

📸 *Photo & Details:* Will be shared shortly

✅ _Our team will contact you soon with best matching properties._

🏢 *City Real Space*
📞 +91 98250 31247
🌐 cityrealspace.com`;
}

export async function sendFollowUpReminder(lead: { name: string; phone: string; requirements?: string | null }) {
  const msg = `Hi ${lead.name}! 👋\n\nThis is a reminder from *City Real Space*, Ahmedabad.\n\nWe have some great properties matching your requirement: ${lead.requirements || "your search"}.\n\nWould you like to schedule a site visit? Reply YES or call us anytime.\n\n📞 City Real Space | Ahmedabad`;
  return sendWhatsApp(lead.phone, msg);
}

export async function sendSiteVisitReminder(visit: {
  clientName: string;
  clientPhone: string;
  propertyTitle: string;
  scheduledAt: Date;
  brokerName: string;
}) {
  const date = visit.scheduledAt.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });
  const time = visit.scheduledAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  const msg = `Hi ${visit.clientName}! 🏠\n\n*Site Visit Reminder*\nProperty: ${visit.propertyTitle}\nDate: ${date}\nTime: ${time}\nBroker: ${visit.brokerName}\n\nPlease confirm your visit. Reply CONFIRM or RESCHEDULE.\n\n📍 City Real Space, Ahmedabad`;
  return sendWhatsApp(visit.clientPhone, msg);
}

export async function sendPropertyRecommendation(lead: {
  name: string;
  phone: string;
  properties: Array<{ title: string; price: number; locality: string }>;
}) {
  const propList = lead.properties
    .slice(0, 3)
    .map((p, i) => `${i + 1}. ${p.title} - ₹${p.price.toLocaleString("en-IN")} | ${p.locality}`)
    .join("\n");
  const msg = `Hi ${lead.name}! 🏢\n\n*New Properties Matching Your Requirements*\n\n${propList}\n\nInterested? Reply with the number to know more or schedule a visit!\n\n🏠 City Real Space | Ahmedabad`;
  return sendWhatsApp(lead.phone, msg);
}

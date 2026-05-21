import twilio from "twilio";

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const FROM = process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886";

export async function sendWhatsApp(to: string, message: string, mediaUrl?: string) {
  const formattedTo = to.startsWith("whatsapp:") ? to : `whatsapp:+91${to.replace(/\D/g, "").slice(-10)}`;
  return client.messages.create({
    from: FROM,
    to: formattedTo,
    body: message,
    ...(mediaUrl ? { mediaUrl: [mediaUrl] } : {}),
  });
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

  const msg = `Hi ${lead.name}! 🏢\n\n*New Properties Matching Your Requirements*\n\n${propList}\n\nInterested? Reply with the number to know more or schedule a visit!\n\n🏠 City Real Space | Ahmedabad\n📞 Contact us anytime`;
  return sendWhatsApp(lead.phone, msg);
}

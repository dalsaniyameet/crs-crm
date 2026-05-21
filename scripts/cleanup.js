const { PrismaClient } = require("@prisma/client");

const p = new PrismaClient({
  datasources: { db: { url: "postgresql://postgres:CityReal2024%40@db.yjisoyiektnkhitihbzb.supabase.co:5432/postgres" } },
});

async function main() {
  console.log("Deleting dummy data...");

  // Use raw SQL TRUNCATE CASCADE — fastest and bypasses FK order issues
  await p.$executeRawUnsafe(`
    TRUNCATE TABLE
      chat_messages,
      chat_members,
      chat_rooms,
      notifications,
      property_matches,
      commissions,
      documents,
      campaigns,
      guest_attendances,
      tasks,
      activities,
      site_visits,
      deals,
      leave_requests,
      leads,
      commercial_details,
      residential_details,
      properties,
      owner_messages,
      property_owners,
      employee_documents,
      salary_slips,
      ai_logs
    RESTART IDENTITY CASCADE
  `);

  console.log("✅ All dummy data deleted!");
  console.log("✅ Users, attendance locations, employee profiles kept.");

  // Verify
  const counts = await Promise.all([
    p.lead.count(),
    p.property.count(),
    p.deal.count(),
    p.notification.count(),
    p.campaign.count(),
  ]);
  console.log(`Leads: ${counts[0]}, Properties: ${counts[1]}, Deals: ${counts[2]}, Notifications: ${counts[3]}, Campaigns: ${counts[4]}`);
}

main().catch(e => console.error("ERROR:", e.message)).finally(() => p.$disconnect());

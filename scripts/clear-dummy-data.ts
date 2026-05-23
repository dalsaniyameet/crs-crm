import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL || process.env.DATABASE_URL } },
});

const DUMMY_LEAD_IDS    = ["lead1","lead2","lead3","lead4","lead5","lead6","lead7","lead8","lead9","lead10","lead11","lead12"];
const DUMMY_PROP_IDS    = ["prop1","prop2","prop3","prop4","prop5","prop6"];
const DUMMY_DEAL_IDS    = ["deal1","deal2","deal3","deal4","deal5","deal6"];
const DUMMY_COMM_IDS    = ["comm1","comm2","comm3","comm4","comm5","comm6"];
const DUMMY_VISIT_IDS   = ["visit1","visit2","visit3","visit4","visit5"];
const DUMMY_USER_EMAILS = ["kiran.demo@cityrealspace.com","neha.demo@cityrealspace.com","ravi.demo@cityrealspace.com","amit.demo@cityrealspace.com"];

async function main() {
  console.log("🗑️  Clearing dummy seed data...");

  // Delete in correct order (foreign key constraints)
  await prisma.commission.deleteMany({ where: { id: { in: DUMMY_COMM_IDS } } });
  console.log("✓ Commissions deleted");

  await prisma.propertyMatch.deleteMany({ where: { leadId: { in: DUMMY_LEAD_IDS } } });
  console.log("✓ Property matches deleted");

  await prisma.siteVisit.deleteMany({ where: { id: { in: DUMMY_VISIT_IDS } } });
  console.log("✓ Site visits deleted");

  await prisma.activity.deleteMany({ where: { leadId: { in: DUMMY_LEAD_IDS } } });
  await prisma.activity.deleteMany({ where: { dealId: { in: DUMMY_DEAL_IDS } } });
  console.log("✓ Activities deleted");

  await prisma.task.deleteMany({ where: { leadId: { in: DUMMY_LEAD_IDS } } });
  console.log("✓ Tasks deleted");

  await prisma.notification.deleteMany({ where: { leadId: { in: DUMMY_LEAD_IDS } } });
  console.log("✓ Notifications deleted");

  await prisma.callLog.deleteMany({ where: { leadId: { in: DUMMY_LEAD_IDS } } });
  console.log("✓ Call logs deleted");

  await prisma.document.deleteMany({ where: { leadId: { in: DUMMY_LEAD_IDS } } });
  await prisma.document.deleteMany({ where: { propertyId: { in: DUMMY_PROP_IDS } } });
  await prisma.document.deleteMany({ where: { dealId: { in: DUMMY_DEAL_IDS } } });
  console.log("✓ Documents deleted");

  // Delete demo user related data before deleting users
  const demoUsers = await prisma.user.findMany({ where: { email: { in: DUMMY_USER_EMAILS } }, select: { id: true } });
  const demoUserIds = demoUsers.map(u => u.id);
  await prisma.notification.deleteMany({ where: { userId: { in: demoUserIds } } });
  await prisma.task.deleteMany({ where: { assignedToId: { in: demoUserIds } } });
  await prisma.activity.deleteMany({ where: { userId: { in: demoUserIds } } });
  await prisma.attendance.deleteMany({ where: { userId: { in: demoUserIds } } });
  await prisma.chatMember.deleteMany({ where: { userId: { in: demoUserIds } } });
  await prisma.chatMessage.deleteMany({ where: { senderId: { in: demoUserIds } } });
  console.log("✓ Demo user related data deleted");

  await prisma.deal.deleteMany({ where: { id: { in: DUMMY_DEAL_IDS } } });
  console.log("✓ Deals deleted");

  await prisma.lead.deleteMany({ where: { id: { in: DUMMY_LEAD_IDS } } });
  console.log("✓ Leads deleted");

  await prisma.commercialDetail.deleteMany({ where: { propertyId: { in: DUMMY_PROP_IDS } } });
  await prisma.residentialDetail.deleteMany({ where: { propertyId: { in: DUMMY_PROP_IDS } } });
  await prisma.property.deleteMany({ where: { id: { in: DUMMY_PROP_IDS } } });
  console.log("✓ Properties deleted");

  // Delete demo broker users (only demo ones, not real admin)
  await prisma.user.deleteMany({ where: { email: { in: DUMMY_USER_EMAILS } } });
  console.log("✓ Demo users deleted");

  console.log("\n✅ Done! Database is clean. Real data is safe.");
}

main()
  .catch(e => { console.error("❌ Error:", e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());

import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL || process.env.DATABASE_URL } },
});

const DUMMY_CLERK_IDS = ["demo_admin", "demo_kiran", "demo_neha", "demo_ravi", "demo_amit"];
const DUMMY_LEAD_IDS   = ["lead1","lead2","lead3","lead4","lead5","lead6","lead7","lead8","lead9","lead10","lead11","lead12"];
const DUMMY_PROP_IDS   = ["prop1","prop2","prop3","prop4","prop5","prop6"];
const DUMMY_DEAL_IDS   = ["deal1","deal2","deal3","deal4","deal5","deal6"];
const DUMMY_COMM_IDS   = ["comm1","comm2","comm3","comm4","comm5","comm6"];
const DUMMY_VISIT_IDS  = ["visit1","visit2","visit3","visit4","visit5"];

async function main() {
  // Delete dummy relational data first
  await prisma.commission.deleteMany({ where: { id: { in: DUMMY_COMM_IDS } } });
  await prisma.propertyMatch.deleteMany({ where: { leadId: { in: DUMMY_LEAD_IDS } } });
  await prisma.activity.deleteMany({ where: { OR: [{ leadId: { in: DUMMY_LEAD_IDS } }, { dealId: { in: DUMMY_DEAL_IDS } }] } });
  await prisma.siteVisit.deleteMany({ where: { id: { in: DUMMY_VISIT_IDS } } });
  await prisma.deal.deleteMany({ where: { id: { in: DUMMY_DEAL_IDS } } });
  await prisma.lead.deleteMany({ where: { id: { in: DUMMY_LEAD_IDS } } });

  // Delete dummy properties (cascade deletes commercial/residential details)
  await prisma.property.deleteMany({ where: { id: { in: DUMMY_PROP_IDS } } });

  // Delete dummy users
  const users = await prisma.user.findMany({ where: { clerkId: { in: DUMMY_CLERK_IDS } }, select: { id: true } });
  const ids = users.map(u => u.id);
  if (ids.length) {
    await prisma.commission.deleteMany({ where: { brokerId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }

  console.log(`✅ All dummy data deleted`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

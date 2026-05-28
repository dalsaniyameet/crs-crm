import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL || process.env.DATABASE_URL } },
});

async function main() {
  const leadCount = await prisma.lead.count();
  const users = await prisma.user.findMany({
    select: { id: true, name: true, role: true, email: true },
  });
  console.log("Total leads in DB:", leadCount);
  console.log("Users:", JSON.stringify(users, null, 2));

  if (leadCount > 0) {
    const sample = await prisma.lead.findMany({ take: 3, select: { id: true, name: true, phone: true, assignedToId: true } });
    console.log("Sample leads:", JSON.stringify(sample, null, 2));
  }
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());

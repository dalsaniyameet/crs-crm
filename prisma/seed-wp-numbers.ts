import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const prisma = new PrismaClient();

async function main() {
  const numbers = [
    { number: "9274731247",  label: "Sales Line 1" },
    { number: "9081888081",  label: "Sales Line 2" },
    { number: "9274831247",  label: "Owner Line"   },
    { number: "9825031247",  label: "Support Line" },
  ];
  for (const n of numbers) {
    await prisma.wpNumber.upsert({ where: { number: n.number }, update: { label: n.label }, create: n });
    console.log(`✅ ${n.label} — ${n.number}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());

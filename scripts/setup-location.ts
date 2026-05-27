import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL || process.env.DATABASE_URL } },
});

async function main() {
  const locs = await prisma.attendanceLocation.findMany();
  console.log("Existing locations:", JSON.stringify(locs, null, 2));

  if (locs.length === 0) {
    console.log("No locations found — creating main office...");
    const loc = await prisma.attendanceLocation.create({
      data: {
        id:        "main-office",
        name:      "City Real Space — Main Office",
        address:   "A-708, Prahlad Nagar Trade Centre, Satellite, Ahmedabad",
        latitude:  23.03507,
        longitude: 72.52398,
        radius:    500, // 500m radius — flexible for employees
        isActive:  true,
      },
    });
    console.log("Created:", loc);
  } else {
    console.log("Locations already exist.");
  }
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());

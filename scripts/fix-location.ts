import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  // PNTC - Prahlad Nagar Trade Centre, Satellite, Ahmedabad
  const PNTC_LAT = 23.022505;
  const PNTC_LNG = 72.507101;
  const RADIUS   = 500; // 500 meters

  const existing = await prisma.attendanceLocation.findFirst();

  if (existing) {
    await prisma.attendanceLocation.update({
      where: { id: existing.id },
      data: {
        name:      "PNTC - Prahlad Nagar Trade Centre",
        address:   "A-708, Prahlad Nagar Trade Centre, Satellite, Ahmedabad - 380015",
        latitude:  PNTC_LAT,
        longitude: PNTC_LNG,
        radius:    RADIUS,
        isActive:  true,
      },
    });
    console.log("✅ Location updated:", existing.id);
  } else {
    const loc = await prisma.attendanceLocation.create({
      data: {
        name:      "PNTC - Prahlad Nagar Trade Centre",
        address:   "A-708, Prahlad Nagar Trade Centre, Satellite, Ahmedabad - 380015",
        latitude:  PNTC_LAT,
        longitude: PNTC_LNG,
        radius:    RADIUS,
        isActive:  true,
      },
    });
    console.log("✅ Location created:", loc.id);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());

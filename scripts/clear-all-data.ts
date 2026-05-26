import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL || process.env.DATABASE_URL } },
});

async function main() {
  console.log("🗑️  Clearing all dummy/seed data...");

  // Delete in correct order (foreign key constraints)
  await prisma.notification.deleteMany({});
  await prisma.activity.deleteMany({});
  await prisma.propertyMatch.deleteMany({});
  await prisma.commission.deleteMany({});
  await prisma.siteVisit.deleteMany({});
  await prisma.deal.deleteMany({});
  await prisma.task.deleteMany({});
  await prisma.callLog.deleteMany({});
  await prisma.lead.deleteMany({});
  await prisma.residentialDetail.deleteMany({});
  await prisma.commercialDetail.deleteMany({});
  await prisma.property.deleteMany({});
  await prisma.campaign.deleteMany({});
  await prisma.guestAttendance.deleteMany({});
  await prisma.attendance.deleteMany({});
  await prisma.leaveRequest.deleteMany({});
  await prisma.dailyReport.deleteMany({});
  await prisma.employeeDocument.deleteMany({});
  await prisma.salarySlip.deleteMany({});
  await prisma.employeeProfile.deleteMany({});
  await prisma.ownerMessage.deleteMany({});
  await prisma.propertyOwner.deleteMany({});
  await prisma.agreement.deleteMany({});
  await prisma.chatMessage.deleteMany({});
  await prisma.chatMember.deleteMany({});
  await prisma.chatRoom.deleteMany({});
  await prisma.document.deleteMany({});
  await prisma.aILog.deleteMany({});

  // Delete demo users only (keep real admin)
  await prisma.user.deleteMany({
    where: {
      clerkId: { in: ["demo_kiran", "demo_neha", "demo_ravi", "demo_amit"] },
    },
  });

  console.log("✅ All dummy data cleared!");
  console.log("ℹ️  Real admin users and attendance locations are preserved.");
  console.log("ℹ️  Now go to Admin → Employees to add real employees.");
}

main()
  .catch(e => { console.error("❌ Error:", e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());

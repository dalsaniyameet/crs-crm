import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding CRM data...");

  // Get admin user
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (!admin) { console.error("No admin user found. Run sync-users.ts first."); process.exit(1); }

  // ── Brokers (use existing users or create dummy ones) ──
  let broker1 = await prisma.user.findFirst({ where: { role: "BROKER" } });
  if (!broker1) {
    broker1 = await prisma.user.upsert({
      where: { email: "broker1@cityrealspace.com" },
      update: {},
      create: { clerkId: "dummy_broker1", email: "broker1@cityrealspace.com", name: "Rahul Shah", role: "BROKER" },
    });
  }

  // ── Property Owners ──
  const owner1 = await prisma.propertyOwner.upsert({
    where: { id: "owner_seed_1" },
    update: {},
    create: { id: "owner_seed_1", name: "Ramesh Patel", phone: "9876543210", email: "ramesh@gmail.com", locality: "Prahlad Nagar", company: "Patel Builders" },
  });
  const owner2 = await prisma.propertyOwner.upsert({
    where: { id: "owner_seed_2" },
    update: {},
    create: { id: "owner_seed_2", name: "Suresh Mehta", phone: "9876543211", locality: "SG Highway", company: "Mehta Realty" },
  });

  // ── Properties ──
  const prop1 = await prisma.property.upsert({
    where: { id: "prop_seed_1" },
    update: {},
    create: {
      id: "prop_seed_1", title: "Premium Office Space - Prahlad Nagar", type: "OFFICE",
      category: "COMMERCIAL", transactionType: "RENT", status: "AVAILABLE",
      price: 85000, area: 1200, locality: "Prahlad Nagar", city: "Ahmedabad",
      isVerified: true, isFeatured: true, listedById: admin.id, ownerId: owner1.id,
      amenities: ["Parking", "Lift", "Power Backup", "AC"],
      commercial: { create: { rentPerSqFt: 70, deposit: 255000, parkingSlots: 3, liftAvailable: true } },
    },
  });

  const prop2 = await prisma.property.upsert({
    where: { id: "prop_seed_2" },
    update: {},
    create: {
      id: "prop_seed_2", title: "3BHK Luxury Apartment - SG Highway", type: "APARTMENT",
      category: "RESIDENTIAL", transactionType: "BUY", status: "AVAILABLE",
      price: 8500000, area: 1800, locality: "SG Highway", city: "Ahmedabad",
      isVerified: true, listedById: broker1.id, ownerId: owner2.id,
      amenities: ["Swimming Pool", "Gym", "Clubhouse", "Parking"],
      residential: { create: { bhk: 3, bathrooms: 3, furnishing: "SEMI_FURNISHED", society: "Shivalik Heights", gatedCommunity: true, swimmingPool: true, gym: true } },
    },
  });

  const prop3 = await prisma.property.upsert({
    where: { id: "prop_seed_3" },
    update: {},
    create: {
      id: "prop_seed_3", title: "Showroom Space - CG Road", type: "SHOWROOM",
      category: "COMMERCIAL", transactionType: "RENT", status: "AVAILABLE",
      price: 120000, area: 2000, locality: "CG Road", city: "Ahmedabad",
      isVerified: true, listedById: admin.id,
      amenities: ["Corner Plot", "High Footfall", "Parking"],
      commercial: { create: { rentPerSqFt: 60, deposit: 360000, parkingSlots: 5 } },
    },
  });

  const prop4 = await prisma.property.upsert({
    where: { id: "prop_seed_4" },
    update: {},
    create: {
      id: "prop_seed_4", title: "2BHK Apartment - Bopal", type: "APARTMENT",
      category: "RESIDENTIAL", transactionType: "RENT", status: "AVAILABLE",
      price: 18000, area: 1100, locality: "Bopal", city: "Ahmedabad",
      listedById: broker1.id,
      residential: { create: { bhk: 2, bathrooms: 2, furnishing: "FULLY_FURNISHED", society: "Shyamal Row House" } },
    },
  });

  // ── Leads ──
  const today = new Date();
  const leads = await Promise.all([
    prisma.lead.upsert({
      where: { id: "lead_seed_1" },
      update: {},
      create: {
        id: "lead_seed_1", name: "Amit Sharma", phone: "9898989898", email: "amit@gmail.com",
        source: "WHATSAPP", status: "NEW", score: 92, budget: 9000000, budgetMax: 12000000,
        propertyType: "APARTMENT", category: "RESIDENTIAL", transactionType: "BUY",
        preferredAreas: ["SG Highway", "Prahlad Nagar"], requirements: "3BHK with parking, good society",
        assignedToId: admin.id, nextFollowUpAt: new Date(today.getTime() + 86400000),
      },
    }),
    prisma.lead.upsert({
      where: { id: "lead_seed_2" },
      update: {},
      create: {
        id: "lead_seed_2", name: "Priya Desai", phone: "9797979797", email: "priya@gmail.com",
        source: "MAGICBRICKS", status: "CONTACTED", score: 78, budget: 80000, budgetMax: 100000,
        propertyType: "OFFICE", category: "COMMERCIAL", transactionType: "RENT",
        preferredAreas: ["Prahlad Nagar", "Satellite"], requirements: "1000-1500 sqft office with parking",
        assignedToId: broker1.id, lastContactedAt: new Date(), nextFollowUpAt: new Date(today.getTime() + 172800000),
      },
    }),
    prisma.lead.upsert({
      where: { id: "lead_seed_3" },
      update: {},
      create: {
        id: "lead_seed_3", name: "Vikram Joshi", phone: "9696969696",
        source: "REFERRAL", status: "SITE_VISIT_SCHEDULED", score: 85, budget: 15000000,
        propertyType: "SHOWROOM", category: "COMMERCIAL", transactionType: "BUY",
        preferredAreas: ["CG Road", "Navrangpura"], requirements: "Corner showroom, high footfall area",
        assignedToId: admin.id, lastContactedAt: new Date(),
      },
    }),
    prisma.lead.upsert({
      where: { id: "lead_seed_4" },
      update: {},
      create: {
        id: "lead_seed_4", name: "Neha Patel", phone: "9595959595", email: "neha@gmail.com",
        source: "FACEBOOK", status: "NEGOTIATION", score: 88, budget: 7000000, budgetMax: 8500000,
        propertyType: "APARTMENT", category: "RESIDENTIAL", transactionType: "BUY",
        preferredAreas: ["Bopal", "South Bopal"], requirements: "2-3BHK, school nearby",
        assignedToId: broker1.id, lastContactedAt: new Date(),
      },
    }),
    prisma.lead.upsert({
      where: { id: "lead_seed_5" },
      update: {},
      create: {
        id: "lead_seed_5", name: "Rajesh Kumar", phone: "9494949494",
        source: "ACRES99", status: "DEAL_CLOSED", score: 95, budget: 8500000,
        propertyType: "APARTMENT", category: "RESIDENTIAL", transactionType: "BUY",
        preferredAreas: ["SG Highway"], assignedToId: admin.id, lastContactedAt: new Date(),
      },
    }),
    prisma.lead.upsert({
      where: { id: "lead_seed_6" },
      update: {},
      create: {
        id: "lead_seed_6", name: "Sunita Agarwal", phone: "9393939393", email: "sunita@gmail.com",
        source: "WALK_IN", status: "NEW", score: 65, budget: 20000, budgetMax: 25000,
        propertyType: "APARTMENT", category: "RESIDENTIAL", transactionType: "RENT",
        preferredAreas: ["Bopal", "Ghuma"], assignedToId: broker1.id,
        nextFollowUpAt: new Date(today.getTime() + 86400000),
      },
    }),
  ]);

  // ── Deals ──
  const deal1 = await prisma.deal.upsert({
    where: { id: "deal_seed_1" },
    update: {},
    create: {
      id: "deal_seed_1", title: "Amit Sharma - SG Highway 3BHK",
      stage: "NEGOTIATION", value: 8500000, commission: 255000, commissionRate: 3,
      leadId: leads[0].id, propertyId: prop2.id, brokerId: admin.id,
      notes: "Client interested, negotiating on price",
    },
  });

  const deal2 = await prisma.deal.upsert({
    where: { id: "deal_seed_2" },
    update: {},
    create: {
      id: "deal_seed_2", title: "Priya Desai - Prahlad Nagar Office",
      stage: "SITE_VISIT", value: 85000, commission: 85000, commissionRate: 100,
      leadId: leads[1].id, propertyId: prop1.id, brokerId: broker1.id,
    },
  });

  const deal3 = await prisma.deal.upsert({
    where: { id: "deal_seed_3" },
    update: {},
    create: {
      id: "deal_seed_3", title: "Rajesh Kumar - SG Highway Apartment",
      stage: "CLOSED", value: 8500000, commission: 255000, commissionRate: 3,
      tokenAmount: 100000, tokenDate: new Date(today.getTime() - 1296000000),
      agreementDate: new Date(today.getTime() - 864000000),
      closedAt: new Date(today.getTime() - 432000000),
      leadId: leads[4].id, propertyId: prop2.id, brokerId: admin.id,
    },
  });

  const deal4 = await prisma.deal.upsert({
    where: { id: "deal_seed_4" },
    update: {},
    create: {
      id: "deal_seed_4", title: "Vikram Joshi - CG Road Showroom",
      stage: "TOKEN", value: 120000, commission: 120000, commissionRate: 100,
      tokenAmount: 50000, tokenDate: new Date(),
      leadId: leads[2].id, propertyId: prop3.id, brokerId: admin.id,
    },
  });

  // ── Site Visits ──
  await prisma.siteVisit.upsert({
    where: { id: "visit_seed_1" },
    update: {},
    create: {
      id: "visit_seed_1", scheduledAt: new Date(today.setHours(11, 0, 0, 0)),
      status: "SCHEDULED", leadId: leads[0].id, propertyId: prop2.id, brokerId: admin.id,
      notes: "Client coming with family",
    },
  });

  const today2 = new Date();
  await prisma.siteVisit.upsert({
    where: { id: "visit_seed_2" },
    update: {},
    create: {
      id: "visit_seed_2", scheduledAt: new Date(today2.setHours(14, 30, 0, 0)),
      status: "CONFIRMED", leadId: leads[1].id, propertyId: prop1.id, brokerId: broker1.id,
    },
  });

  await prisma.siteVisit.upsert({
    where: { id: "visit_seed_3" },
    update: {},
    create: {
      id: "visit_seed_3", scheduledAt: new Date(new Date().setDate(new Date().getDate() - 2)),
      status: "COMPLETED", rating: 4, feedback: "Very interested, will confirm in 2 days",
      leadId: leads[2].id, propertyId: prop3.id, brokerId: admin.id,
    },
  });

  // ── Commissions ──
  await prisma.commission.upsert({
    where: { id: "comm_seed_1" },
    update: {},
    create: {
      id: "comm_seed_1", amount: 255000, rate: 3, isPaid: true,
      paidAt: new Date(new Date().getTime() - 432000000),
      dealId: deal3.id, brokerId: admin.id, notes: "Full commission received",
    },
  });

  await prisma.commission.upsert({
    where: { id: "comm_seed_2" },
    update: {},
    create: {
      id: "comm_seed_2", amount: 255000, rate: 3, isPaid: false,
      dealId: deal1.id, brokerId: admin.id, notes: "Pending - deal in negotiation",
    },
  });

  await prisma.commission.upsert({
    where: { id: "comm_seed_3" },
    update: {},
    create: {
      id: "comm_seed_3", amount: 120000, rate: 100, isPaid: false,
      dealId: deal4.id, brokerId: admin.id,
    },
  });

  // ── Campaigns ──
  await prisma.campaign.upsert({
    where: { id: "camp_seed_1" },
    update: {},
    create: {
      id: "camp_seed_1", name: "Diwali Property Offers 2024", type: "WHATSAPP",
      status: "SENT", content: "🏠 Special Diwali offers on premium properties in Ahmedabad!",
      sentAt: new Date(new Date().getTime() - 604800000), recipients: 150, opened: 98, clicked: 45,
      createdById: admin.id,
    },
  });

  await prisma.campaign.upsert({
    where: { id: "camp_seed_2" },
    update: {},
    create: {
      id: "camp_seed_2", name: "New Commercial Listings - May 2025", type: "EMAIL",
      status: "DRAFT", content: "Check out our latest commercial properties on SG Highway and CG Road.",
      createdById: admin.id,
    },
  });

  // ── Notifications ──
  await prisma.notification.createMany({
    skipDuplicates: true,
    data: [
      { id: "notif_1", type: "FOLLOW_UP_DUE", title: "Follow-up Due", message: "Follow up with Amit Sharma today", userId: admin.id, leadId: leads[0].id },
      { id: "notif_2", type: "SITE_VISIT_REMINDER", title: "Site Visit Today", message: "Priya Desai visit at 2:30 PM - Prahlad Nagar Office", userId: admin.id },
      { id: "notif_3", type: "DEAL_UPDATE", title: "Deal Token Received", message: "Vikram Joshi paid ₹50,000 token for CG Road Showroom", userId: admin.id },
    ],
  });

  console.log("✅ Seed complete!");
  console.log("   Leads: 6 | Properties: 4 | Deals: 4 | Visits: 3 | Commissions: 3");
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());

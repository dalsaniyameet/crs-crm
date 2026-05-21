import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL || process.env.DATABASE_URL,
    },
  },
});

async function main() {
  console.log("🌱 Seeding City Real Space CRM...");

  // Use real synced users — create demo broker users if needed
  const demoUsers = await Promise.all([
    prisma.user.upsert({ where: { email: "kiran.demo@cityrealspace.com" }, update: {}, create: { clerkId: "demo_kiran", name: "Kiran Mehta",  email: "kiran.demo@cityrealspace.com", role: "BROKER" } }),
    prisma.user.upsert({ where: { email: "neha.demo@cityrealspace.com"  }, update: {}, create: { clerkId: "demo_neha",  name: "Neha Shah",   email: "neha.demo@cityrealspace.com",  role: "BROKER" } }),
    prisma.user.upsert({ where: { email: "ravi.demo@cityrealspace.com"  }, update: {}, create: { clerkId: "demo_ravi",  name: "Ravi Patel",  email: "ravi.demo@cityrealspace.com",  role: "BROKER" } }),
    prisma.user.upsert({ where: { email: "amit.demo@cityrealspace.com"  }, update: {}, create: { clerkId: "demo_amit",  name: "Amit Joshi",  email: "amit.demo@cityrealspace.com",  role: "BROKER" } }),
  ]);
  const [kiran, neha, ravi, amit] = demoUsers;

  // Properties
  const props = await Promise.all([
    prisma.property.upsert({ where: { id: "prop1" }, update: {}, create: {
      id: "prop1", title: "Premium Office Space – Prahlad Nagar", type: "OFFICE", category: "COMMERCIAL",
      transactionType: "RENT", status: "AVAILABLE", price: 75000, area: 2200, carpetArea: 1800,
      locality: "Prahlad Nagar", city: "Ahmedabad", amenities: ["Parking", "AC", "Power Backup", "Lift"],
      photos: ["https://images.unsplash.com/photo-1497366216548-37526070297c?w=800"],
      isVerified: true, isFeatured: true, commissionRate: 2, listedById: kiran.id,
      commercial: { create: { rentPerSqFt: 34, deposit: 225000, parkingSlots: 4, lockInPeriod: 24 } },
    }}),
    prisma.property.upsert({ where: { id: "prop2" }, update: {}, create: {
      id: "prop2", title: "Luxury 3BHK Apartment – Satellite", type: "APARTMENT", category: "RESIDENTIAL",
      transactionType: "SELL", status: "AVAILABLE", price: 11500000, area: 1850, carpetArea: 1450,
      locality: "Satellite", city: "Ahmedabad", amenities: ["Swimming Pool", "Gym", "Clubhouse", "Security"],
      photos: ["https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800"],
      isVerified: true, commissionRate: 1.5, listedById: neha.id,
      residential: { create: { bhk: 3, bathrooms: 3, furnishing: "SEMI_FURNISHED", gatedCommunity: true, swimmingPool: true, gym: true } },
    }}),
    prisma.property.upsert({ where: { id: "prop3" }, update: {}, create: {
      id: "prop3", title: "Showroom Space – SG Highway", type: "SHOWROOM", category: "COMMERCIAL",
      transactionType: "RENT", status: "AVAILABLE", price: 60000, area: 650, carpetArea: 520,
      locality: "SG Highway", city: "Ahmedabad", amenities: ["Parking", "AC", "24/7 Security"],
      photos: ["https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800"],
      isVerified: true, commissionRate: 2.5, listedById: ravi.id,
      commercial: { create: { deposit: 180000, parkingSlots: 2 } },
    }}),
    prisma.property.upsert({ where: { id: "prop4" }, update: {}, create: {
      id: "prop4", title: "Warehouse – Vatva GIDC", type: "WAREHOUSE", category: "COMMERCIAL",
      transactionType: "LEASE", status: "AVAILABLE", price: 250000, area: 8000, carpetArea: 7500,
      locality: "Vatva GIDC", city: "Ahmedabad", amenities: ["Loading Dock", "Power Backup", "Security"],
      photos: ["https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=800"],
      isVerified: true, commissionRate: 1, listedById: kiran.id,
      commercial: { create: { deposit: 750000, lockInPeriod: 36, leaseTermMonths: 36 } },
    }}),
    prisma.property.upsert({ where: { id: "prop5" }, update: {}, create: {
      id: "prop5", title: "4BHK Luxury Villa – Bopal", type: "VILLA", category: "RESIDENTIAL",
      transactionType: "SELL", status: "AVAILABLE", price: 28000000, area: 3200, carpetArea: 2600,
      locality: "Bopal", city: "Ahmedabad", amenities: ["Private Pool", "Garden", "Gym", "Smart Home"],
      photos: ["https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800"],
      isVerified: true, isFeatured: true, commissionRate: 1.5, listedById: neha.id,
      residential: { create: { bhk: 4, bathrooms: 4, furnishing: "FULLY_FURNISHED", gatedCommunity: true, swimmingPool: true } },
    }}),
    prisma.property.upsert({ where: { id: "prop6" }, update: {}, create: {
      id: "prop6", title: "Office Space – Bodakdev", type: "OFFICE", category: "COMMERCIAL",
      transactionType: "RENT", status: "RENTED", price: 45000, area: 1200, carpetArea: 950,
      locality: "Bodakdev", city: "Ahmedabad", amenities: ["Parking", "AC", "Lift"],
      photos: ["https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=800"],
      isVerified: true, commissionRate: 2, listedById: amit.id,
      commercial: { create: { deposit: 135000, parkingSlots: 2 } },
    }}),
  ]);

  // Leads
  const leadsData = [
    { id: "lead1", name: "Rajesh Patel",   phone: "9876543210", email: "rajesh@example.com",   source: "WHATSAPP",    status: "NEW",                  score: 92, budget: 80000,    propertyType: "OFFICE",     category: "COMMERCIAL",  transactionType: "RENT", requirements: "Office space 2000sqft in Prahlad Nagar under ₹80K/month",    assignedToId: kiran.id },
    { id: "lead2", name: "Meera Shah",     phone: "9876543211", email: "meera@example.com",     source: "MAGICBRICKS", status: "CONTACTED",            score: 87, budget: 12000000, propertyType: "APARTMENT",  category: "RESIDENTIAL", transactionType: "BUY",  requirements: "3BHK apartment in Satellite under 1.2Cr",                    assignedToId: neha.id  },
    { id: "lead3", name: "Amit Desai",     phone: "9876543212", email: "amit.d@example.com",    source: "ACRES99",     status: "SITE_VISIT_SCHEDULED", score: 81, budget: 60000,    propertyType: "SHOWROOM",   category: "COMMERCIAL",  transactionType: "RENT", requirements: "Showroom 500sqft on SG Highway",                             assignedToId: ravi.id  },
    { id: "lead4", name: "Priya Mehta",    phone: "9876543213", email: "priya@example.com",     source: "WEBSITE",     status: "NEGOTIATION",          score: 76, budget: 250000,   propertyType: "WAREHOUSE",  category: "COMMERCIAL",  transactionType: "LEASE",requirements: "Warehouse 5000sqft in Vatva GIDC",                           assignedToId: kiran.id },
    { id: "lead5", name: "Suresh Kumar",   phone: "9876543214", email: "suresh@example.com",    source: "REFERRAL",    status: "NEGOTIATION",          score: 95, budget: 30000000, propertyType: "VILLA",      category: "RESIDENTIAL", transactionType: "BUY",  requirements: "4BHK villa in Bopal or Shilaj under 3Cr",                    assignedToId: neha.id  },
    { id: "lead6", name: "Vikram Joshi",   phone: "9876543216", email: "vikram@example.com",    source: "WHATSAPP",    status: "DEAL_CLOSED",          score: 88, budget: 45000,    propertyType: "OFFICE",     category: "COMMERCIAL",  transactionType: "RENT", requirements: "Office 1000-1500sqft in Bodakdev",                           assignedToId: amit.id  },
    { id: "lead7", name: "Kavita Patel",   phone: "9876543217", email: "kavita@example.com",    source: "ACRES99",     status: "NEW",                  score: 65, budget: 40000,    propertyType: "SHOP",       category: "COMMERCIAL",  transactionType: "RENT", requirements: "Shop 400sqft in Navrangpura or CG Road",                     assignedToId: ravi.id  },
    { id: "lead8", name: "Anita Sharma",   phone: "9876543218", email: "anita@example.com",     source: "WEBSITE",     status: "CONTACTED",            score: 72, budget: 8000000,  propertyType: "APARTMENT",  category: "RESIDENTIAL", transactionType: "BUY",  requirements: "2BHK or 3BHK in Thaltej or Gota under 80L",                  assignedToId: neha.id  },
    { id: "lead9", name: "Deepak Shah",    phone: "9876543219", email: "deepak@example.com",    source: "FACEBOOK",    status: "NEW",                  score: 58, budget: 15000000, propertyType: "APARTMENT",  category: "RESIDENTIAL", transactionType: "BUY",  requirements: "3BHK in Prahlad Nagar or Satellite",                         assignedToId: kiran.id },
    { id: "lead10",name: "Ritu Agarwal",   phone: "9876543220", email: "ritu@example.com",      source: "MAGICBRICKS", status: "SITE_VISIT_SCHEDULED", score: 79, budget: 55000,    propertyType: "OFFICE",     category: "COMMERCIAL",  transactionType: "RENT", requirements: "Office 1500sqft in Ahmedabad West",                          assignedToId: amit.id  },
    { id: "lead11",name: "Nikhil Verma",   phone: "9876543221", email: "nikhil@example.com",    source: "WALK_IN",     status: "CONTACTED",            score: 83, budget: 20000000, propertyType: "VILLA",      category: "RESIDENTIAL", transactionType: "BUY",  requirements: "3BHK or 4BHK villa in South Bopal",                          assignedToId: neha.id  },
    { id: "lead12",name: "Pooja Trivedi",  phone: "9876543222", email: "pooja@example.com",     source: "REFERRAL",    status: "NEW",                  score: 61, budget: 35000,    propertyType: "SHOP",       category: "COMMERCIAL",  transactionType: "RENT", requirements: "Small shop 200-300sqft for retail in Vastrapur",             assignedToId: ravi.id  },
  ];

  const leads = await Promise.all(leadsData.map(l =>
    prisma.lead.upsert({ where: { id: l.id }, update: {}, create: l as any })
  ));

  // Deals
  const dealsData = [
    { id: "deal1", title: "Office Space – Prahlad Nagar", stage: "NEGOTIATION", value: 900000,   commission: 18000,  commissionRate: 2,   leadId: leads[0].id, propertyId: props[0].id, brokerId: kiran.id },
    { id: "deal2", title: "3BHK Apartment – Satellite",   stage: "SITE_VISIT",  value: 11500000, commission: 172500, commissionRate: 1.5, leadId: leads[1].id, propertyId: props[1].id, brokerId: neha.id  },
    { id: "deal3", title: "Showroom – SG Highway",        stage: "NEGOTIATION", value: 660000,   commission: 16500,  commissionRate: 2.5, leadId: leads[2].id, propertyId: props[2].id, brokerId: ravi.id  },
    { id: "deal4", title: "Warehouse – Vatva GIDC",       stage: "TOKEN",       value: 2160000,  commission: 21600,  commissionRate: 1,   leadId: leads[3].id, propertyId: props[3].id, brokerId: kiran.id },
    { id: "deal5", title: "4BHK Villa – Bopal",           stage: "AGREEMENT",   value: 28000000, commission: 420000, commissionRate: 1.5, leadId: leads[4].id, propertyId: props[4].id, brokerId: neha.id  },
    { id: "deal6", title: "Office – Bodakdev",            stage: "CLOSED",      value: 540000,   commission: 10800,  commissionRate: 2,   leadId: leads[5].id, propertyId: props[5].id, brokerId: amit.id, closedAt: new Date("2024-03-14") },
  ];

  const deals = await Promise.all(dealsData.map(d =>
    prisma.deal.upsert({ where: { id: d.id }, update: {}, create: d as any })
  ));

  // Commissions
  await Promise.all([
    prisma.commission.upsert({ where: { id: "comm1" }, update: {}, create: { id: "comm1", amount: 18000,  rate: 2,   isPaid: true,  paidAt: new Date("2024-03-10"), dealId: deals[0].id, brokerId: kiran.id } }),
    prisma.commission.upsert({ where: { id: "comm2" }, update: {}, create: { id: "comm2", amount: 172500, rate: 1.5, isPaid: false, dealId: deals[1].id, brokerId: neha.id  } }),
    prisma.commission.upsert({ where: { id: "comm3" }, update: {}, create: { id: "comm3", amount: 16500,  rate: 2.5, isPaid: true,  paidAt: new Date("2024-03-12"), dealId: deals[2].id, brokerId: ravi.id  } }),
    prisma.commission.upsert({ where: { id: "comm4" }, update: {}, create: { id: "comm4", amount: 21600,  rate: 1,   isPaid: false, dealId: deals[3].id, brokerId: kiran.id } }),
    prisma.commission.upsert({ where: { id: "comm5" }, update: {}, create: { id: "comm5", amount: 420000, rate: 1.5, isPaid: false, dealId: deals[4].id, brokerId: neha.id  } }),
    prisma.commission.upsert({ where: { id: "comm6" }, update: {}, create: { id: "comm6", amount: 10800,  rate: 2,   isPaid: true,  paidAt: new Date("2024-03-14"), dealId: deals[5].id, brokerId: amit.id  } }),
  ]);

  // Site Visits
  const now = new Date();
  await Promise.all([
    prisma.siteVisit.upsert({ where: { id: "visit1" }, update: {}, create: { id: "visit1", scheduledAt: new Date(now.getTime() + 2*60*60*1000),  status: "CONFIRMED",  leadId: leads[0].id, propertyId: props[0].id, brokerId: kiran.id } }),
    prisma.siteVisit.upsert({ where: { id: "visit2" }, update: {}, create: { id: "visit2", scheduledAt: new Date(now.getTime() + 4*60*60*1000),  status: "SCHEDULED",  leadId: leads[1].id, propertyId: props[1].id, brokerId: neha.id  } }),
    prisma.siteVisit.upsert({ where: { id: "visit3" }, update: {}, create: { id: "visit3", scheduledAt: new Date(now.getTime() + 24*60*60*1000), status: "SCHEDULED",  leadId: leads[2].id, propertyId: props[2].id, brokerId: ravi.id  } }),
    prisma.siteVisit.upsert({ where: { id: "visit4" }, update: {}, create: { id: "visit4", scheduledAt: new Date(now.getTime() - 2*60*60*1000),  status: "COMPLETED",  leadId: leads[4].id, propertyId: props[4].id, brokerId: neha.id, feedback: "Very interested, wants to negotiate price.", completedAt: new Date() } }),
    prisma.siteVisit.upsert({ where: { id: "visit5" }, update: {}, create: { id: "visit5", scheduledAt: new Date(now.getTime() - 5*60*60*1000),  status: "NO_SHOW",    leadId: leads[5].id, propertyId: props[5].id, brokerId: amit.id  } }),
  ]);

  // Property Matches
  await prisma.propertyMatch.createMany({
    data: [
      { leadId: leads[0].id, propertyId: props[0].id, score: 95 },
      { leadId: leads[1].id, propertyId: props[1].id, score: 92 },
      { leadId: leads[2].id, propertyId: props[2].id, score: 88 },
      { leadId: leads[4].id, propertyId: props[4].id, score: 97 },
    ],
    skipDuplicates: true,
  });

  // Activities
  await prisma.activity.createMany({
    data: [
      { type: "LEAD_CREATED",  description: "New lead: Rajesh Patel (Score: 92)",          leadId: leads[0].id },
      { type: "LEAD_CONTACTED",description: "Called Rajesh Patel – Interested in office",  leadId: leads[0].id },
      { type: "VISIT_DONE",    description: "Site visit completed – Suresh Kumar at Bopal", leadId: leads[4].id },
      { type: "DEAL_CLOSED",   description: "Deal closed – Bodakdev office ₹10,800 commission", dealId: deals[5].id },
      { type: "AI_MATCH",      description: "AI matched 4 properties for active leads" },
    ],
    skipDuplicates: false,
  });

  // Attendance Locations
  await Promise.all([
    prisma.attendanceLocation.upsert({ where: { id: "loc1" }, update: { address: "A-708, Prahlad Nagar Trade Centre, Satellite, Ahmedabad", latitude: 23.03507, longitude: 72.52398, radius: 100 }, create: { id: "loc1", name: "City Real Space – Main Office", address: "A-708, Prahlad Nagar Trade Centre, Satellite, Ahmedabad", latitude: 23.03507, longitude: 72.52398, radius: 100 } }),
  ]);

  console.log("✅ Seed complete! 12 leads, 6 properties, 6 deals, 5 attendance locations added.");
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

import https from "https";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const SECRET = "sk_test_0lTWakNCjkZYuJLij3hZG2Dz0mdstkt7BsjqqTuKLc";

function getClerkUsers(): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: "api.clerk.com", path: "/v1/users?limit=100", method: "GET",
      headers: { Authorization: `Bearer ${SECRET}` },
    }, res => {
      let raw = "";
      res.on("data", c => (raw += c));
      res.on("end", () => resolve(JSON.parse(raw)));
    });
    req.on("error", reject);
    req.end();
  });
}

async function main() {
  const result = await getClerkUsers();
  const users = result.data ?? result;
  for (const cu of users) {
    const email = cu.email_addresses[0]?.email_address;
    if (!email) continue;
    const name = [cu.first_name, cu.last_name].filter(Boolean).join(" ") || email;
    const role = (cu.public_metadata?.role as string)?.toUpperCase() || "BROKER";
    await prisma.user.upsert({
      where: { clerkId: cu.id },
      update: { name, email, role },
      create: { clerkId: cu.id, name, email, role },
    });
    console.log(`✅ Synced: ${name} (${role})`);
  }
  await prisma.$disconnect();
  console.log("Done!");
}

main().catch(console.error);

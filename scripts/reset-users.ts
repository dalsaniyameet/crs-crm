import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
async function main() {
  const r = await p.user.deleteMany();
  console.log("Deleted users:", r.count);
  await p.$disconnect();
}
main().catch(console.error);

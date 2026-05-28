/**
 * npx tsx scripts/set-admin.ts
 */
import https from "https";
require("dotenv").config({ path: ".env.local" });

const SECRET_KEY = process.env.CLERK_SECRET_KEY || "";
const EMAIL      = "info@cityrealspace.com";

if (!SECRET_KEY) {
  console.error("❌ CLERK_SECRET_KEY not found in .env.local");
  process.exit(1);
}

function clerkRequest(method: string, path: string, body?: object): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : undefined;
    const req  = https.request({
      hostname: "api.clerk.com",
      path,
      method,
      headers: {
        Authorization: `Bearer ${SECRET_KEY}`,
        "Content-Type": "application/json",
        ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}),
      },
    }, (res) => {
      let raw = "";
      res.on("data", c => raw += c);
      res.on("end", () => resolve(JSON.parse(raw)));
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  // Get all users
  const result = await clerkRequest("GET", "/v1/users?limit=100") as { data: Array<{ id: string; email_addresses: Array<{ email_address: string }> }> };
  const users  = result.data ?? result;

  const user = (users as Array<{ id: string; email_addresses: Array<{ email_address: string }> }>)
    .find(u => u.email_addresses.some(e => e.email_address === EMAIL));

  if (!user) { console.error("User not found:", EMAIL); process.exit(1); }

  await clerkRequest("PATCH", `/v1/users/${user.id}`, { public_metadata: { role: "ADMIN" } });
  console.log(`✅ ${EMAIL} is now ADMIN — please logout and login again`);
}

main();

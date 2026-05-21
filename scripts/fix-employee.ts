import https from "https";
import { config } from "dotenv";
config({ path: ".env.local" });

const SECRET = process.env.CLERK_SECRET_KEY!;
const EMAIL    = "patelshriji72@gmail.com";
const PASSWORD = "CRSRajesh@Shriji#2026!";
const NAME     = "Rajesh Patel";

function clerkReq(method: string, path: string, body?: object): Promise<any> {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : undefined;
    const req = https.request({
      hostname: "api.clerk.com", path, method,
      headers: { Authorization: `Bearer ${SECRET}`, "Content-Type": "application/json", ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}) },
    }, res => { let raw = ""; res.on("data", c => raw += c); res.on("end", () => resolve(JSON.parse(raw))); });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  console.log("Using Clerk key:", SECRET?.slice(0, 20) + "...");

  // Check if exists
  const list = await clerkReq("GET", `/v1/users?email_address=${encodeURIComponent(EMAIL)}`);
  const users = list.data ?? list;

  if (users.length > 0) {
    console.log("User exists, deleting...");
    await clerkReq("DELETE", `/v1/users/${users[0].id}`);
    console.log("Deleted.");
  }

  // Create fresh
  const result = await clerkReq("POST", "/v1/users", {
    email_address: [EMAIL],
    password: PASSWORD,
    first_name: NAME.split(" ")[0],
    last_name: NAME.split(" ")[1] || "",
    skip_password_checks: true,
    skip_password_requirement: true,
    public_metadata: { role: "BROKER" },
  });

  if (result.errors) {
    console.error("Error:", JSON.stringify(result.errors, null, 2));
  } else {
    console.log("✅ Created in correct Clerk app!");
    console.log("   ID:", result.id);
    console.log("   Email:", EMAIL);
    console.log("   Password:", PASSWORD);
  }
}
main().catch(console.error);

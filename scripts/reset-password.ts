import https from "https";
import { config } from "dotenv";
config({ path: ".env.local" });

const SECRET   = process.env.CLERK_SECRET_KEY!;
const EMAIL    = "patelshriji72@gmail.com";
const PASSWORD = "Shriji4829";

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
  const list = await clerkReq("GET", `/v1/users?email_address=${encodeURIComponent(EMAIL)}`);
  const u = (list.data ?? list)[0];
  if (!u) { console.log("❌ Not found"); return; }

  const r = await clerkReq("PATCH", `/v1/users/${u.id}`, {
    password: PASSWORD,
    skip_password_checks: true,
  });

  if (r.errors) { console.error("❌", JSON.stringify(r.errors)); return; }
  console.log("✅ Password updated!");
  console.log("   Email   :", EMAIL);
  console.log("   Password:", PASSWORD);
}
main().catch(console.error);

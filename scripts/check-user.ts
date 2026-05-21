import https from "https";
const SECRET   = "sk_test_0lTWakNCjkZYuJLij3hZG2Dz0mdstkt7BsjqqTuKLc";
const EMAIL    = "patelshriji72@gmail.com";
const PASSWORD = "CRSRajesh@Shriji#2026!";

function clerkReq(method: string, path: string, body?: object, extraHeaders?: object): Promise<any> {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : undefined;
    const req = https.request({
      hostname: "api.clerk.com", path, method,
      headers: { Authorization: `Bearer ${SECRET}`, "Content-Type": "application/json", ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}), ...extraHeaders },
    }, res => { let raw = ""; res.on("data", c => raw += c); res.on("end", () => resolve(JSON.parse(raw))); });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  // Get user details
  const list = await clerkReq("GET", `/v1/users?email_address=${encodeURIComponent(EMAIL)}`);
  const u = (list.data ?? list)[0];
  if (!u) { console.log("❌ User not found"); return; }

  console.log("=== USER DETAILS ===");
  console.log("ID:", u.id);
  console.log("two_factor_enabled:", u.two_factor_enabled);
  console.log("password_enabled:", u.password_enabled);
  console.log("totp_enabled:", u.totp_enabled);
  console.log("backup_code_enabled:", u.backup_code_enabled);
  console.log("phone_numbers:", JSON.stringify(u.phone_numbers));
  console.log("external_accounts:", JSON.stringify(u.external_accounts?.map((e: any) => e.provider)));

  // Check Clerk instance MFA settings
  const instance = await clerkReq("GET", "/v1/instance");
  console.log("\n=== INSTANCE MFA SETTINGS ===");
  console.log(JSON.stringify(instance?.mfa ?? instance?.auth_config ?? "no mfa field", null, 2));
}
main().catch(console.error);

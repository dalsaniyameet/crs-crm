import https from "https";

const SECRET = "sk_test_0lTWakNCjkZYuJLij3hZG2Dz0mdstkt7BsjqqTuKLc";
const EMAIL  = "patelshriji72@gmail.com";

function clerkReq(method: string, path: string, body?: object): Promise<any> {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : undefined;
    const req = https.request({
      hostname: "api.clerk.com", path, method,
      headers: { Authorization: `Bearer ${SECRET}`, "Content-Type": "application/json", ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}) },
    }, res => { let raw = ""; res.on("data", c => raw += c); res.on("end", () => resolve(raw ? JSON.parse(raw) : {})); });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  // Find user
  const list = await clerkReq("GET", `/v1/users?email_address=${encodeURIComponent(EMAIL)}`);
  const users = list.data ?? list;
  if (!users.length) { console.log("❌ User not found"); return; }

  const user = users[0];
  console.log(`Found user: ${user.id}`);

  // Delete all TOTP factors
  const factors: any[] = user.totp_enabled ? [] : [];
  const allFactors = await clerkReq("GET", `/v1/users/${user.id}/totp`);
  console.log("TOTP status:", JSON.stringify(allFactors));

  // Disable 2FA by updating user — remove all second factors
  const updated = await clerkReq("PATCH", `/v1/users/${user.id}`, {
    totp_enabled: false,
    backup_code_enabled: false,
  });

  if (updated.errors) {
    console.error("Error:", JSON.stringify(updated.errors));
    // Fallback: delete and recreate
    console.log("Falling back to delete + recreate...");
    await clerkReq("DELETE", `/v1/users/${user.id}`);
    console.log("✅ Deleted. Now run: npx ts-node scripts/create-clerk-user.ts");
  } else {
    console.log("✅ 2FA disabled for", EMAIL);
  }
}
main().catch(console.error);

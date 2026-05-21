import https from "https";

// Use the publishable key to simulate frontend sign-in
const PK = "pk_test_Y2xlcmsuY2l0eXJlYWxzcGFjZS5jb20k"; // from .env.local
const EMAIL = "patelshriji72@gmail.com";
const PASSWORD = "CRSRajesh@Shriji#2026!";

function req(method: string, hostname: string, path: string, body?: object, headers?: object): Promise<any> {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : undefined;
    const r = https.request({
      hostname, path, method,
      headers: { "Content-Type": "application/json", ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}), ...headers },
    }, res => { let raw = ""; res.on("data", c => raw += c); res.on("end", () => { try { resolve(JSON.parse(raw)); } catch { resolve(raw); } }); });
    r.on("error", reject);
    if (data) r.write(data);
    r.end();
  });
}

async function main() {
  // Check user's 2FA status directly
  const SECRET = "sk_test_0lTWakNCjkZYuJLij3hZG2Dz0mdstkt7BsjqqTuKLc";
  const listReq = await req("GET", "api.clerk.com", `/v1/users?email_address=${encodeURIComponent(EMAIL)}`, undefined, { Authorization: `Bearer ${SECRET}` });
  const u = (listReq.data ?? listReq)[0];
  
  console.log("User ID:", u?.id);
  console.log("two_factor_enabled:", u?.two_factor_enabled);
  console.log("totp_enabled:", u?.totp_enabled);
  console.log("backup_code_enabled:", u?.backup_code_enabled);
  console.log("phone_numbers:", JSON.stringify(u?.phone_numbers));
  
  // Check all MFA methods
  if (u?.id) {
    const mfa = await req("GET", "api.clerk.com", `/v1/users/${u.id}`, undefined, { Authorization: `Bearer ${SECRET}` });
    console.log("\nFull user second_factors:", JSON.stringify(mfa.second_factors));
    console.log("mfa_enabled_at:", mfa.mfa_enabled_at);
    console.log("password_enabled:", mfa.password_enabled);
    
    // Try verify password
    const verify = await req("POST", "api.clerk.com", `/v1/users/${u.id}/verify_password`, { password: PASSWORD }, { Authorization: `Bearer ${SECRET}` });
    console.log("\nPassword verify result:", JSON.stringify(verify));
  }
}
main().catch(console.error);

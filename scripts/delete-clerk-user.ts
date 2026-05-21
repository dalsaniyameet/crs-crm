import https from "https";

const SECRET = "sk_test_0lTWakNCjkZYuJLij3hZG2Dz0mdstkt7BsjqqTuKLc";
const EMAIL = "patelshriji72@gmail.com";

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
  const result = await clerkReq("GET", `/v1/users?email_address=${encodeURIComponent(EMAIL)}`);
  const users = result.data ?? result;
  if (!users.length) { console.log("User not found in Clerk"); return; }
  for (const u of users) {
    await clerkReq("DELETE", `/v1/users/${u.id}`);
    console.log(`✅ Deleted from Clerk: ${u.id}`);
  }
}
main().catch(console.error);

import https from "https";

const SECRET = "sk_test_0lTWakNCjkZYuJLij3hZG2Dz0mdstkt7BsjqqTuKLc";

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
  const email = "patelshriji72@gmail.com";
  const password = "CRSRajesh$7x9Qm2026";

  // Check if exists
  const list = await clerkReq("GET", `/v1/users?email_address=${encodeURIComponent(email)}`);
  const users = list.data ?? list;

  let result;
  if (users.length > 0) {
    console.log("User exists, updating password...");
    result = await clerkReq("PATCH", `/v1/users/${users[0].id}`, {
      password,
      skip_password_checks: true,
    });
  } else {
    console.log("Creating new user...");
    result = await clerkReq("POST", "/v1/users", {
      email_address: [email],
      password,
      first_name: "rajesh",
      skip_password_checks: true,
    });
  }

  if (result.errors) {
    console.error("Clerk error:", JSON.stringify(result.errors));
  } else {
    console.log("✅ Done! Clerk ID:", result.id);
  }
}
main().catch(console.error);

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
  // Get instance settings
  const instance = await clerkReq("GET", "/v1/instance");
  console.log("=== INSTANCE AUTH CONFIG ===");
  console.log(JSON.stringify(instance, null, 2));
}
main().catch(console.error);

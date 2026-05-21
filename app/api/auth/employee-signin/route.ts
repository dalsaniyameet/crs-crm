import { NextRequest, NextResponse } from "next/server";
import https from "https";

const SECRET = process.env.CLERK_SECRET_KEY!;

function clerkREST(method: string, path: string, body?: object): Promise<any> {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : undefined;
    const req = https.request({
      hostname: "api.clerk.com", path, method,
      headers: {
        Authorization: `Bearer ${SECRET}`,
        "Content-Type": "application/json",
        ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}),
      },
    }, res => { let raw = ""; res.on("data", c => raw += c); res.on("end", () => resolve(JSON.parse(raw))); });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password)
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });

    // Find user
    const list = await clerkREST("GET", `/v1/users?email_address=${encodeURIComponent(email)}`);
    const users = list.data ?? list;
    if (!users.length)
      return NextResponse.json({ error: "No account found. Contact your admin." }, { status: 404 });

    const clerkUser = users[0];

    // Verify password via Clerk backend
    const verify = await clerkREST("POST", `/v1/users/${clerkUser.id}/verify_password`, { password });
    if (!verify.verified)
      return NextResponse.json({ error: "Incorrect password. Please try again." }, { status: 401 });

    // Create a sign-in token (Clerk's official way to bypass 2FA / custom auth)
    const tokenRes = await clerkREST("POST", `/v1/sign_in_tokens`, {
      user_id: clerkUser.id,
      expires_in_seconds: 60,
    });

    if (tokenRes.errors || !tokenRes.token)
      return NextResponse.json({ error: "Failed to create login token." }, { status: 500 });

    return NextResponse.json({ token: tokenRes.token });
  } catch (err: any) {
    console.error("employee-signin error:", err?.message);
    return NextResponse.json({ error: "Login failed. Contact admin." }, { status: 500 });
  }
}

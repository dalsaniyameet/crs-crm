import { NextRequest, NextResponse } from "next/server";
import https from "https";
import { otpStore } from "../send-otp/route";

function clerkREST(method: string, path: string, body?: object): Promise<any> {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : undefined;
    const req = https.request({
      hostname: "api.clerk.com", path, method,
      headers: {
        Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
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
    const { email, otp } = await req.json();
    if (!email || !otp) return NextResponse.json({ error: "Email and OTP required" }, { status: 400 });

    const norm = email.toLowerCase().trim();
    const record = otpStore.get(norm);

    if (!record) return NextResponse.json({ error: "OTP not found. Please request a new one." }, { status: 400 });
    if (Date.now() > record.expires) {
      otpStore.delete(norm);
      return NextResponse.json({ error: "OTP expired. Please request a new one." }, { status: 400 });
    }
    if (record.attempts >= 3) {
      otpStore.delete(norm);
      return NextResponse.json({ error: "Too many attempts. Please request a new OTP." }, { status: 429 });
    }
    if (record.otp !== otp.trim()) {
      record.attempts++;
      return NextResponse.json({ error: `Incorrect OTP. ${3 - record.attempts} attempts left.` }, { status: 400 });
    }

    otpStore.delete(norm);

    // Generate Clerk sign-in token
    const list = await clerkREST("GET", `/v1/users?email_address=${encodeURIComponent(norm)}`);
    const users = list.data ?? list;
    if (!users.length) return NextResponse.json({ error: "Admin account not found." }, { status: 404 });

    const tokenRes = await clerkREST("POST", `/v1/sign_in_tokens`, {
      user_id: users[0].id,
      expires_in_seconds: 60,
    });
    if (tokenRes.errors || !tokenRes.token)
      return NextResponse.json({ error: "Failed to create login token." }, { status: 500 });

    return NextResponse.json({ success: true, token: tokenRes.token });
  } catch {
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}

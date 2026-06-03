import { NextRequest, NextResponse } from "next/server";
import { sendEmployeeEmail } from "@/lib/email";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "meetdalsaniya143@gmail.com,info@cityrealspace.com")
  .split(",").map(e => e.trim().toLowerCase());

// In-memory OTP store
export const otpStore = new Map<string, { otp: string; expires: number; attempts: number }>();

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

    const norm = email.toLowerCase().trim();
    if (!ADMIN_EMAILS.includes(norm)) {
      return NextResponse.json({ error: "Not an admin email" }, { status: 403 });
    }

    // Rate limit: 1 per 60s
    const existing = otpStore.get(norm);
    if (existing && existing.expires > Date.now() + 4 * 60 * 1000) {
      return NextResponse.json({ error: "OTP already sent. Wait 60 seconds." }, { status: 429 });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore.set(norm, { otp, expires: Date.now() + 5 * 60 * 1000, attempts: 0 });

    await sendEmployeeEmail(
      norm,
      "🔐 Your CRS Admin OTP",
      `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;background:#04080f;border-radius:16px;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#1e3a5f,#0f2744);padding:32px;text-align:center;">
          <div style="font-size:48px;margin-bottom:8px;">🔐</div>
          <h1 style="margin:0;font-size:22px;color:#eab308;">City Real Space CRM</h1>
          <p style="margin:6px 0 0;color:#94a3b8;font-size:13px;">Admin Login Verification</p>
        </div>
        <div style="padding:32px;text-align:center;background:#060c18;">
          <p style="color:#94a3b8;margin:0 0 20px;font-size:14px;">Your one-time password:</p>
          <div style="background:#0f1f35;border:2px solid #eab308;border-radius:16px;padding:24px 32px;display:inline-block;margin-bottom:24px;">
            <div style="font-size:48px;font-weight:900;letter-spacing:16px;color:#eab308;font-family:monospace;">${otp}</div>
          </div>
          <p style="color:#64748b;font-size:12px;margin:0;">Valid for <strong style="color:#fff;">5 minutes</strong> only.</p>
          <p style="color:#64748b;font-size:12px;margin:8px 0 0;">Do not share this OTP with anyone.</p>
        </div>
        <div style="background:#030609;padding:14px;text-align:center;border-top:1px solid rgba(234,179,8,0.1);">
          <p style="margin:0;color:#475569;font-size:11px;">© City Real Space CRM · Ahmedabad</p>
        </div>
      </div>`
    );

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Send OTP error:", err.message);
    return NextResponse.json({ error: "Failed to send OTP" }, { status: 500 });
  }
}

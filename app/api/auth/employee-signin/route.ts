import { NextRequest, NextResponse } from "next/server";
import https from "https";
import { prisma } from "@/lib/prisma";

const SECRET = process.env.CLERK_SECRET_KEY!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://crs-crm.vercel.app";

// Get approximate location from IP using free ipapi.co
async function getLocationFromIP(ip: string): Promise<string> {
  try {
    const res = await fetch(`https://ipapi.co/${ip}/json/`, { signal: AbortSignal.timeout(3000) });
    const d = await res.json();
    if (d.city) return `${d.city}, ${d.region}, ${d.country_name}`;
  } catch {}
  return "Unknown Location";
}


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
    const { email, password, isAdmin } = await req.json();
    if (!email || !password)
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });

    // Block admin emails from employee login (but allow admin password login)
    const adminEmails = (process.env.ADMIN_EMAILS || "").split(",").map(e => e.trim().toLowerCase());
    if (!isAdmin && adminEmails.includes(email.toLowerCase()))
      return NextResponse.json({ error: "Use Admin tab to login." }, { status: 403 });

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

    // Send login security alert to admin with location
    const empEmail = clerkUser.email_addresses?.[0]?.email_address || email;
    const empName  = [clerkUser.first_name, clerkUser.last_name].filter(Boolean).join(" ") || empEmail;

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || req.headers.get("x-real-ip")
      || "Unknown";
    const location = await getLocationFromIP(ip);
    const loginTime = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour12: true });

    // Send to ADMIN_EMAILS + all DB admins
    const dbAdminEmails = await prisma.user.findMany({
      where: { role: { in: ["ADMIN" as any, "SALES_MANAGER" as any] }, isActive: true },
      select: { email: true },
    }).then(rows => rows.map(r => r.email).filter(Boolean)).catch(() => [] as string[]);
    const envEmails = (process.env.ADMIN_EMAILS || "").split(",").map(e => e.trim()).filter(Boolean);
    const allAdminEmails = [...new Set([...envEmails, ...dbAdminEmails])];

    const loginHtml = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0f172a;padding:0;border-radius:12px;overflow:hidden">
  <div style="background:#dc2626;padding:18px 24px">
    <h2 style="color:#fff;margin:0;font-size:18px">🔐 Employee Login Alert</h2>
    <p style="color:#fca5a5;margin:4px 0 0;font-size:13px">City Real Space CRM Security Notification</p>
  </div>
  <div style="background:#1e293b;padding:24px">
    <table style="width:100%;border-collapse:collapse">
      <tr><td style="padding:8px 10px;color:#94a3b8;font-size:13px;width:130px">Employee</td><td style="padding:8px 10px;color:#fff;font-size:14px"><strong>${empName}</strong></td></tr>
      <tr style="background:#0f172a"><td style="padding:8px 10px;color:#94a3b8;font-size:13px">Email</td><td style="padding:8px 10px;color:#fff;font-size:14px">${empEmail}</td></tr>
      <tr><td style="padding:8px 10px;color:#94a3b8;font-size:13px">Login Time</td><td style="padding:8px 10px;color:#fbbf24;font-size:14px"><strong>${loginTime}</strong></td></tr>
      <tr style="background:#0f172a"><td style="padding:8px 10px;color:#94a3b8;font-size:13px">📍 Location</td><td style="padding:8px 10px;color:#34d399;font-size:14px"><strong>${location}</strong></td></tr>
      <tr><td style="padding:8px 10px;color:#94a3b8;font-size:13px">IP Address</td><td style="padding:8px 10px;color:#94a3b8;font-size:13px">${ip}</td></tr>
    </table>
    <div style="margin-top:16px;padding:12px;border:1px solid #dc2626;border-radius:8px">
      <p style="color:#fca5a5;font-size:13px;margin:0">⚠️ If this login was not from the office, please contact admin immediately.</p>
    </div>
    <div style="margin-top:16px">
      <a href="${APP_URL}/admin-employees" style="display:inline-block;padding:10px 22px;background:#dc2626;color:#fff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:bold">View Employee Panel →</a>
    </div>
  </div>
  <div style="background:#0f172a;padding:12px 24px;text-align:center">
    <p style="color:#475569;font-size:11px;margin:0">City Real Space | Ahmedabad | cityrealspace.com</p>
  </div>
</div>`;

    // Send login alert to all admin emails (env + DB admins)
    const nodemailer = (await import("nodemailer")).default;
    const port = parseInt(process.env.EMAIL_PORT || "465");
    const secure = process.env.EMAIL_SECURE === "true" || port === 465;
    if (process.env.EMAIL_PASS && process.env.EMAIL_PASS !== "YOUR_EMAIL_PASSWORD") {
      const t = nodemailer.createTransport({
        host: process.env.EMAIL_HOST || "smtpout.secureserver.net",
        port, secure,
        auth: { user: process.env.EMAIL_USER || "info@cityrealspace.com", pass: process.env.EMAIL_PASS },
        tls: { rejectUnauthorized: false },
        connectionTimeout: 15000,
      });
      const FROM = `"City Real Space CRM" <${process.env.EMAIL_USER || "info@cityrealspace.com"}>`;
      await Promise.all(allAdminEmails.map(to =>
        t.sendMail({ from: FROM, to, subject: `🔐 Employee Login: ${empName} from ${location}`, html: loginHtml }).catch(() => {})
      ));
    } else {
      const { sendAdminEmail } = await import("@/lib/email");
      sendAdminEmail(`🔐 Employee Login: ${empName} from ${location}`, loginHtml).catch(() => {});
    }

    return NextResponse.json({ token: tokenRes.token });
  } catch (err: any) {
    console.error("employee-signin error:", err?.message);
    return NextResponse.json({ error: "Login failed. Contact admin." }, { status: 500 });
  }
}

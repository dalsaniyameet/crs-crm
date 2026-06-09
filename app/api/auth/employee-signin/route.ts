import { NextRequest, NextResponse } from "next/server";
import https from "https";
import { prisma } from "@/lib/prisma";

const SECRET = process.env.CLERK_SECRET_KEY!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://cityrealspacecrm.com";

// Get approximate location from IP — multiple fallback services
async function getLocationFromIP(ip: string): Promise<string> {
  if (!ip || ip === "Unknown" || ip === "::1" || ip.startsWith("127.") || ip.startsWith("192.168.") || ip.startsWith("10.") || ip.startsWith("172.")) {
    return "Local / Office Network";
  }

  // Service 1: ipwho.is (HTTPS, Vercel compatible, no key needed)
  try {
    const res = await fetch(`https://ipwho.is/${ip}`, { signal: AbortSignal.timeout(5000) });
    const d = await res.json();
    if (d.success && d.city) return `${d.city}, ${d.region}, ${d.country}`;
  } catch {}

  // Service 2: ip-api.com via HTTPS (pro fallback)
  try {
    const res = await fetch(`https://pro.ip-api.com/json/${ip}?fields=status,city,regionName,country&key=free`, {
      signal: AbortSignal.timeout(5000),
    });
    const d = await res.json();
    if (d.status === "success" && d.city) return `${d.city}, ${d.regionName}, ${d.country}`;
  } catch {}

  // Service 3: ipapi.co
  try {
    const res = await fetch(`https://ipapi.co/${ip}/json/`, { signal: AbortSignal.timeout(5000) });
    const d = await res.json();
    if (d.city && !d.error) return `${d.city}, ${d.region}, ${d.country_name}`;
  } catch {}

  // Service 4: freeipapi.com
  try {
    const res = await fetch(`https://freeipapi.com/api/json/${ip}`, { signal: AbortSignal.timeout(5000) });
    const d = await res.json();
    if (d.cityName && d.cityName !== "-") return `${d.cityName}, ${d.regionName}, ${d.countryName}`;
  } catch {}

  return `IP: ${ip}`;
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

// ── Office hours check (IST) 9:58 AM – 7:02 PM Mon–Sat ─────────────────────
function checkEmployeeLoginHours(): string | null {
  const now = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  const day = now.getUTCDay();
  if (day === 0) return "CRM is closed on Sundays. See you Monday!";
  const cur = now.getUTCHours() * 60 + now.getUTCMinutes();
  if (cur < 9 * 60 + 58)  return "Office hasn't started yet. CRM login opens at 9:58 AM.";
  if (cur > 19 * 60 + 2)  return "Office hours are over. CRM login closed after 7:02 PM.";
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const { email, password, isAdmin, checkOnly } = await req.json();
    if (!email || !password)
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });

    // Block admin emails from employee login (but allow admin password login)
    const adminEmails = (process.env.ADMIN_EMAILS || "").split(",").map(e => e.trim().toLowerCase());
    if (!isAdmin && adminEmails.includes(email.toLowerCase()))
      return NextResponse.json({ error: "Use Admin tab to login." }, { status: 403 });

    // ── After office hours: create approval request instead of blocking ──
    if (!isAdmin) {
      const hoursErr = checkEmployeeLoginHours();
      if (hoursErr) {
        // Verify password first before creating request
        const listCheck = await clerkREST("GET", `/v1/users?email_address=${encodeURIComponent(email)}`);
        const usersCheck = listCheck.data ?? listCheck;
        if (!usersCheck.length)
          return NextResponse.json({ error: "No account found. Contact your admin." }, { status: 404 });
        const verifyCheck = await clerkREST("POST", `/v1/users/${usersCheck[0].id}/verify_password`, { password });
        if (!verifyCheck.verified)
          return NextResponse.json({ error: "Incorrect password. Please enter the password provided by your admin." }, { status: 401 });

        const ipOt = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "Unknown";
        const locationOt = await getLocationFromIP(ipOt);
        const loginTimeOt = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour12: true });
        const empEmailOt  = usersCheck[0].email_addresses?.[0]?.email_address || email;
        // DB se name lo pehle
        const dbUserOt = await prisma.user.findFirst({
          where: { OR: [{ clerkId: usersCheck[0].id }, { email: empEmailOt }] },
          select: { name: true },
        }).catch(() => null);
        const empNameOt   = dbUserOt?.name
          || [usersCheck[0].first_name, usersCheck[0].last_name].filter(Boolean).join(" ")
          || empEmailOt.split("@")[0];

        // Create approval request (expires in 2 hours)
        const approval = await prisma.overtimeApproval.create({
          data: {
            empEmail:  empEmailOt,
            empName:   empNameOt,
            loginTime: loginTimeOt,
            location:  locationOt,
            ip:        ipOt,
            expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
          },
        });

        // Send approval email to all admins
        const dbAdminEmailsOt = await prisma.user.findMany({
          where: { role: { in: ["ADMIN" as any] }, isActive: true },
          select: { email: true },
        }).then(rows => rows.map(r => r.email).filter(Boolean)).catch(() => [] as string[]);
        const envEmailsOt = (process.env.ADMIN_EMAILS || "").split(",").map(e => e.trim()).filter(Boolean);
        const allAdminEmailsOt = [...new Set([...envEmailsOt, ...dbAdminEmailsOt])];

        const approveUrl = `${APP_URL}/api/auth/overtime-approval?id=${approval.id}&action=APPROVED`;
        const denyUrl    = `${APP_URL}/api/auth/overtime-approval?id=${approval.id}&action=DENIED`;

        const approvalHtml = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0f172a;padding:0;border-radius:12px;overflow:hidden">
  <div style="background:#b45309;padding:18px 24px">
    <h2 style="color:#fff;margin:0;font-size:18px">⏰ After-Hours Login Request</h2>
    <p style="color:#fde68a;margin:4px 0 0;font-size:13px">Employee wants to access CRM outside office hours</p>
  </div>
  <div style="background:#1e293b;padding:24px">
    <table style="width:100%;border-collapse:collapse">
      <tr><td style="padding:8px 10px;color:#94a3b8;font-size:13px;width:130px">Employee</td><td style="padding:8px 10px;color:#fff;font-size:14px"><strong>${empNameOt}</strong></td></tr>
      <tr style="background:#0f172a"><td style="padding:8px 10px;color:#94a3b8;font-size:13px">Email</td><td style="padding:8px 10px;color:#fff;font-size:14px">${empEmailOt}</td></tr>
      <tr><td style="padding:8px 10px;color:#94a3b8;font-size:13px">Login Time</td><td style="padding:8px 10px;color:#fbbf24;font-size:14px"><strong>${loginTimeOt}</strong></td></tr>
      <tr style="background:#0f172a"><td style="padding:8px 10px;color:#94a3b8;font-size:13px">📍 Location</td><td style="padding:8px 10px;color:#34d399;font-size:14px"><strong>${locationOt}</strong></td></tr>
      <tr><td style="padding:8px 10px;color:#94a3b8;font-size:13px">IP Address</td><td style="padding:8px 10px;color:#94a3b8;font-size:13px">${ipOt}</td></tr>
    </table>
    <p style="color:#fde68a;font-size:13px;margin:16px 0 8px">⚠️ This request expires in 2 hours. Please approve or deny:</p>
    <div style="display:flex;gap:12px;margin-top:12px">
      <a href="${approveUrl}" style="display:inline-block;padding:12px 28px;background:#16a34a;color:#fff;text-decoration:none;border-radius:6px;font-size:15px;font-weight:bold">✅ Approve</a>
      <a href="${denyUrl}" style="display:inline-block;padding:12px 28px;background:#dc2626;color:#fff;text-decoration:none;border-radius:6px;font-size:15px;font-weight:bold">❌ Deny</a>
    </div>
  </div>
  <div style="background:#0f172a;padding:12px 24px;text-align:center">
    <p style="color:#475569;font-size:11px;margin:0">City Real Space | Ahmedabad | cityrealspacecrm.com</p>
  </div>
</div>`;

        const nodemailerOt = (await import("nodemailer")).default;
        const portOt = parseInt(process.env.EMAIL_PORT || "465");
        const secureOt = process.env.EMAIL_SECURE === "true" || portOt === 465;
        if (process.env.EMAIL_PASS && process.env.EMAIL_PASS !== "YOUR_EMAIL_PASSWORD") {
          const t = nodemailerOt.createTransport({
            host: process.env.EMAIL_HOST || "smtpout.secureserver.net",
            port: portOt, secure: secureOt,
            auth: { user: process.env.EMAIL_USER || "info@cityrealspace.com", pass: process.env.EMAIL_PASS },
            tls: { rejectUnauthorized: false }, connectionTimeout: 15000,
          });
          const FROM = `"City Real Space CRM" <${process.env.EMAIL_USER || "info@cityrealspace.com"}>`;
          await Promise.all(allAdminEmailsOt.map(to =>
            t.sendMail({ from: FROM, to, subject: `⏰ Overtime Login Request: ${empNameOt} at ${loginTimeOt}`, html: approvalHtml }).catch(() => {})
          ));
        }

        return NextResponse.json({ requiresApproval: true, approvalId: approval.id });
      }
    }

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

    // checkOnly = just verify password, don't create token (used before OTP step)
    if (checkOnly) return NextResponse.json({ verified: true });

    // Create a sign-in token (Clerk's official way to bypass 2FA / custom auth)
    const tokenRes = await clerkREST("POST", `/v1/sign_in_tokens`, {
      user_id: clerkUser.id,
      expires_in_seconds: 60,
    });

    if (tokenRes.errors || !tokenRes.token)
      return NextResponse.json({ error: "Failed to create login token." }, { status: 500 });

    // Send login security alert to admin with location
    const empEmail = clerkUser.email_addresses?.[0]?.email_address || email;
    // Name: DB se pehle lo, warna Clerk first+last, warna email prefix
    const dbUser = await prisma.user.findFirst({
      where: { OR: [{ clerkId: clerkUser.id }, { email: empEmail }] },
      select: { name: true },
    }).catch(() => null);
    const empName = dbUser?.name
      || [clerkUser.first_name, clerkUser.last_name].filter(Boolean).join(" ")
      || empEmail.split("@")[0];

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || req.headers.get("x-real-ip")
      || "Unknown";
    const location = await getLocationFromIP(ip);
    const loginTime = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour12: true });

    // Check if employee already punched out today (re-login after punch out)
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const punchedOutToday = await prisma.guestAttendance.findFirst({
      where: { phone: empEmail, punchOut: { not: null }, createdAt: { gte: todayStart } },
    }).catch(() => null);
    const isReLogin = !!punchedOutToday;

    // Send to ADMIN_EMAILS + all DB admins
    const dbAdminEmails = await prisma.user.findMany({
      where: { role: { in: ["ADMIN" as any, "SALES_MANAGER" as any] }, isActive: true },
      select: { email: true },
    }).then(rows => rows.map(r => r.email).filter(Boolean)).catch(() => [] as string[]);
    const envEmails = (process.env.ADMIN_EMAILS || "").split(",").map(e => e.trim()).filter(Boolean);
    const allAdminEmails = [...new Set([...envEmails, ...dbAdminEmails])];

    const loginHtml = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0f172a;padding:0;border-radius:12px;overflow:hidden">
  <div style="background:${isReLogin ? '#b45309' : '#dc2626'};padding:18px 24px">
    <h2 style="color:#fff;margin:0;font-size:18px">${isReLogin ? '⚠️ Employee Re-Login Alert' : '🔐 Employee Login Alert'}</h2>
    <p style="color:#fca5a5;margin:4px 0 0;font-size:13px">${isReLogin ? 'This employee already punched out today and logged in again!' : 'City Real Space CRM Security Notification'}</p>
  </div>
  <div style="background:#1e293b;padding:24px">
    <table style="width:100%;border-collapse:collapse">
      <tr><td style="padding:8px 10px;color:#94a3b8;font-size:13px;width:130px">Employee</td><td style="padding:8px 10px;color:#fff;font-size:14px"><strong>${empName}</strong></td></tr>
      <tr style="background:#0f172a"><td style="padding:8px 10px;color:#94a3b8;font-size:13px">Email</td><td style="padding:8px 10px;color:#fff;font-size:14px">${empEmail}</td></tr>
      <tr><td style="padding:8px 10px;color:#94a3b8;font-size:13px">Login Time</td><td style="padding:8px 10px;color:#fbbf24;font-size:14px"><strong>${loginTime}</strong></td></tr>
      <tr style="background:#0f172a"><td style="padding:8px 10px;color:#94a3b8;font-size:13px">📍 Location</td><td style="padding:8px 10px;color:#34d399;font-size:14px"><strong>${location}</strong></td></tr>
      <tr><td style="padding:8px 10px;color:#94a3b8;font-size:13px">IP Address</td><td style="padding:8px 10px;color:#94a3b8;font-size:13px">${ip}</td></tr>
      ${isReLogin ? `<tr style="background:#0f172a"><td style="padding:8px 10px;color:#94a3b8;font-size:13px">Status</td><td style="padding:8px 10px;font-size:14px"><strong style="color:#fb923c">⚠️ Re-Login After Punch Out</strong></td></tr>` : ''}
    </table>
    <div style="margin-top:16px;padding:12px;border:1px solid ${isReLogin ? '#b45309' : '#dc2626'};border-radius:8px">
      <p style="color:#fca5a5;font-size:13px;margin:0">${isReLogin ? '⚠️ This employee already punched out today and is logging in again. Please verify if access should be allowed.' : '⚠️ If this login was not authorized, please take action immediately.'}</p>
    </div>
    <div style="margin-top:16px">
      <a href="${APP_URL}/admin-employees" style="display:inline-block;padding:10px 22px;background:${isReLogin ? '#b45309' : '#dc2626'};color:#fff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:bold">View Employee Panel →</a>
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
        t.sendMail({ from: FROM, to, subject: isReLogin ? `⚠️ Re-Login Alert: ${empName} logged in again after punch out` : `🔐 Employee Login: ${empName} from ${location}`, html: loginHtml }).catch(() => {})
      ));
    } else {
      const { sendAdminEmail } = await import("@/lib/email");
      sendAdminEmail(isReLogin ? `⚠️ Re-Login Alert: ${empName} logged in again after punch out` : `🔐 Employee Login: ${empName} from ${location}`, loginHtml).catch(() => {});
    }

    return NextResponse.json({ token: tokenRes.token });
  } catch (err: any) {
    console.error("employee-signin error:", err?.message);
    return NextResponse.json({ error: "Login failed. Contact admin." }, { status: 500 });
  }
}

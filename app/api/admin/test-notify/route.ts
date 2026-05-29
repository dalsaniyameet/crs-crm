import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendAdminEmail } from "@/lib/email";
import nodemailer from "nodemailer";

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (secret !== "crs-test-2024") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const results: Record<string, any> = {};

  // 1. Check DB connection
  try {
    const userCount = await prisma.user.count();
    const adminUsers = await prisma.user.findMany({
      where: { role: "ADMIN" },
      select: { id: true, name: true, email: true, role: true },
    });
    results.db = { ok: true, totalUsers: userCount, adminUsers };
  } catch (e: any) {
    results.db = { ok: false, error: e.message };
  }

  // 2. Check ADMIN_EMAILS env
  const adminEmails = (process.env.ADMIN_EMAILS || "").split(",").map(e => e.trim()).filter(Boolean);
  results.adminEmails = adminEmails;

  // 3. Auto-fix: set ADMIN role for users matching ADMIN_EMAILS
  const fixed: string[] = [];
  for (const email of adminEmails) {
    try {
      const u = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true } });
      if (u && u.role !== "ADMIN") {
        await prisma.user.update({ where: { email }, data: { role: "ADMIN" } });
        fixed.push(`${email} → ADMIN`);
      }
    } catch {}
  }
  results.autoFixed = fixed;

  // 4. Test email SMTP connection
  try {
    const port = parseInt(process.env.EMAIL_PORT || "587");
    const secure = process.env.EMAIL_SECURE === "true" || port === 465;
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || "smtpout.secureserver.net",
      port, secure,
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
      tls: { rejectUnauthorized: false },
      connectionTimeout: 10000,
    });
    await transporter.verify();
    results.smtp = { ok: true, host: process.env.EMAIL_HOST, port, user: process.env.EMAIL_USER };
  } catch (e: any) {
    results.smtp = { ok: false, error: e.message };
  }

  // 5. Send test email to all admins
  try {
    await sendAdminEmail(
      "✅ CRS CRM — Email System Test",
      `<div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;background:#0f172a;padding:24px;border-radius:12px">
        <h2 style="color:#f59e0b;margin:0 0 16px">✅ Email System Working!</h2>
        <p style="color:#e2e8f0;font-size:14px">This is a test email from City Real Space CRM.</p>
        <p style="color:#94a3b8;font-size:13px">Time: ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST</p>
        <p style="color:#94a3b8;font-size:13px">Admin emails: ${adminEmails.join(", ")}</p>
        <p style="color:#4ade80;font-size:13px;margin-top:16px">✅ Notifications & Email are configured correctly.</p>
      </div>`
    );
    results.emailSent = { ok: true, to: adminEmails };
  } catch (e: any) {
    results.emailSent = { ok: false, error: e.message };
  }

  // 6. Create test notification for all admin users
  try {
    const admins = await prisma.user.findMany({
      where: { role: "ADMIN", isActive: true },
      select: { id: true },
    });
    if (admins.length > 0) {
      await Promise.all(admins.map(a =>
        prisma.notification.create({
          data: {
            userId:  a.id,
            type:    "SYSTEM",
            title:   "✅ Notification System Working",
            message: `Test notification sent at ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST`,
            isRead:  false,
          },
        })
      ));
      results.notificationCreated = { ok: true, count: admins.length };
    } else {
      results.notificationCreated = { ok: false, reason: "No ADMIN users in DB — check autoFixed above" };
    }
  } catch (e: any) {
    results.notificationCreated = { ok: false, error: e.message };
  }

  return NextResponse.json(results, { status: 200 });
}

import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { prisma } from "@/lib/prisma";
import { sendAdminEmail, employeeWelcomeEmailHtml } from "@/lib/email";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://crs-crm.vercel.app";

function loginAlertHtml(name: string, email: string, time: string) {
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0f172a;padding:0;border-radius:12px;overflow:hidden">
  <div style="background:linear-gradient(135deg,#1e3a5f,#0f172a);padding:24px 32px;text-align:center">
    <div style="font-size:40px;margin-bottom:8px">&#128275;</div>
    <h1 style="color:#f59e0b;font-size:20px;margin:0 0 4px;font-weight:700">CRM Login Alert</h1>
    <p style="color:#94a3b8;font-size:13px;margin:0">City Real Space CRM — Active Session</p>
  </div>
  <div style="background:#1e293b;padding:20px 32px">
    <div style="background:#0f2d1f;border:1px solid #166534;border-radius:8px;padding:14px;margin-bottom:18px">
      <p style="color:#4ade80;font-size:14px;font-weight:700;margin:0 0 4px">&#10003; User logged in to CRM</p>
      <p style="color:#86efac;font-size:12px;margin:0">A team member has just signed in to the CRM platform.</p>
    </div>
    <table style="width:100%;border-collapse:collapse">
      <tr style="background:#0f172a"><td style="padding:8px 10px;color:#64748b;font-size:13px;width:120px">Name</td><td style="padding:8px 10px;color:#fff;font-size:14px;font-weight:600">${name}</td></tr>
      <tr><td style="padding:8px 10px;color:#64748b;font-size:13px">Email</td><td style="padding:8px 10px;color:#94a3b8;font-size:13px">${email}</td></tr>
      <tr style="background:#0f172a"><td style="padding:8px 10px;color:#64748b;font-size:13px">Time</td><td style="padding:8px 10px;color:#fff;font-size:13px">${time}</td></tr>
    </table>
    <div style="margin-top:18px;text-align:center">
      <a href="${APP_URL}/attendance" style="display:inline-block;padding:10px 22px;background:#f59e0b;color:#0f172a;text-decoration:none;border-radius:8px;font-size:13px;font-weight:700">View Attendance</a>
    </div>
  </div>
  <div style="background:#0f172a;padding:12px 32px;text-align:center;border-top:1px solid #1e293b">
    <p style="color:#475569;font-size:11px;margin:0">City Real Space CRM | Security Notification</p>
  </div>
</div>`;
}

export async function POST(req: NextRequest) {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "No webhook secret" }, { status: 500 });

  const svixId        = req.headers.get("svix-id") ?? "";
  const svixTimestamp = req.headers.get("svix-timestamp") ?? "";
  const svixSignature = req.headers.get("svix-signature") ?? "";

  const body = await req.text();

  let payload: { type: string; data: Record<string, unknown> };
  try {
    const wh = new Webhook(secret);
    payload  = wh.verify(body, {
      "svix-id":        svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as typeof payload;
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const { type, data } = payload;

  // ── User created / updated ──────────────────────────────────────────────
  if (type === "user.created" || type === "user.updated") {
    const emailArr = data.email_addresses as Array<{ email_address: string }>;
    const phoneArr = data.phone_numbers  as Array<{ phone_number: string }> | undefined;
    const email    = emailArr?.[0]?.email_address ?? "";
    const name     = [data.first_name, data.last_name].filter(Boolean).join(" ") || "User";
    const phone    = phoneArr?.[0]?.phone_number ?? undefined;

    await prisma.user.upsert({
      where:  { clerkId: data.id as string },
      update: { email, name, avatar: data.image_url as string, phone },
      create: {
        clerkId: data.id as string,
        email, name,
        avatar: data.image_url as string,
        phone,
        role: "BROKER",
      },
    });

    if (type === "user.created") {
      const emp = await prisma.employeeProfile.findUnique({ where: { email } });
      sendAdminEmail(
        `New User Joined CRS CRM: ${name}`,
        employeeWelcomeEmailHtml({ name, position: emp?.position || "Team Member", email })
      ).catch(() => {});
    }
  }

  // ── Session created = user logged in ────────────────────────────────────
  if (type === "session.created") {
    const userId = data.user_id as string;
    if (userId) {
      const user = await prisma.user.findUnique({
        where: { clerkId: userId },
        select: { name: true, email: true, role: true },
      }).catch(() => null);

      if (user) {
        const time = new Date().toLocaleString("en-IN");
        // Send login alert email to admin
        sendAdminEmail(
          `CRM Login: ${user.name || user.email} signed in`,
          loginAlertHtml(user.name || "Unknown", user.email || "", time)
        ).catch(() => {});

        // Create notification for admins
        const admins = await prisma.user.findMany({
          where: { role: "ADMIN", isActive: true },
          select: { id: true },
        }).catch(() => []);

        await Promise.all(
          admins
            .filter(a => a.id !== (user as any).id)
            .map(a =>
              prisma.notification.create({
                data: {
                  userId:  a.id,
                  type:    "SYSTEM",
                  title:   `${user.name || user.email} logged in`,
                  message: `${user.name || user.email} (${user.role}) signed in to CRM at ${time}.`,
                  isRead:  false,
                },
              }).catch(() => {})
            )
        );
      }
    }
  }

  // ── User deleted ────────────────────────────────────────────────────────
  if (type === "user.deleted") {
    await prisma.user.updateMany({
      where: { clerkId: data.id as string },
      data:  { isActive: false },
    });
  }

  return NextResponse.json({ received: true });
}

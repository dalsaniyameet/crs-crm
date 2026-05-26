import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { sendAdminEmail } from "@/lib/email";

export async function POST() {
  try {
    const { userId } = auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const time = new Date().toLocaleString("en-IN");

    // 1. Notification create - bell madhe alarm trigger hoil
    await prisma.notification.create({
      data: {
        userId:  user.id,
        type:    "SYSTEM",
        title:   "Test Alert - Alarm Vaajtoy!",
        message: `He ek test notification ahe. Alarm vaajtoy aani email pathavlay! - ${time}`,
        isRead:  false,
      },
    });

    // 2. Test email pathavto
    const name = user.name || user.email || "User";
    await sendAdminEmail(
      "Test Alert - CRS CRM Alarm",
      `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0f172a;padding:0;border-radius:12px;overflow:hidden">
  <div style="background:linear-gradient(135deg,#7f1d1d,#0f172a);padding:28px 32px;text-align:center">
    <div style="font-size:48px;margin-bottom:10px">&#128680;</div>
    <h1 style="color:#f87171;font-size:22px;margin:0 0 6px;font-weight:900;letter-spacing:2px">TEST ALARM</h1>
    <p style="color:#fca5a5;font-size:14px;margin:0">City Real Space CRM - Notification System Test</p>
  </div>
  <div style="background:#1e293b;padding:24px 32px">
    <div style="background:#450a0a;border:2px solid #dc2626;border-radius:8px;padding:16px;margin-bottom:20px">
      <p style="color:#f87171;font-size:16px;font-weight:900;margin:0 0 6px">&#9888; Alarm vaajtoy!</p>
      <p style="color:#fca5a5;font-size:13px;margin:0">He ek test alert ahe. Notification bell madhe alarm trigger zala ahe.</p>
    </div>
    <table style="width:100%;border-collapse:collapse">
      <tr style="background:#0f172a">
        <td style="padding:8px 10px;color:#64748b;font-size:13px;width:140px">Triggered By</td>
        <td style="padding:8px 10px;color:#fff;font-size:14px">${name}</td>
      </tr>
      <tr>
        <td style="padding:8px 10px;color:#64748b;font-size:13px">Time</td>
        <td style="padding:8px 10px;color:#fff;font-size:14px">${time}</td>
      </tr>
      <tr style="background:#0f172a">
        <td style="padding:8px 10px;color:#64748b;font-size:13px">Status</td>
        <td style="padding:8px 10px;color:#4ade80;font-size:14px;font-weight:700">Email pathavlay!</td>
      </tr>
    </table>
    <div style="margin-top:20px;text-align:center">
      <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://crs-crm.vercel.app"}/settings"
        style="display:inline-block;padding:10px 24px;background:#dc2626;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:700">
        CRM Ugha
      </a>
    </div>
  </div>
  <div style="background:#0f172a;padding:12px 32px;text-align:center;border-top:1px solid #1e293b">
    <p style="color:#475569;font-size:11px;margin:0">City Real Space CRM | Notification System Test</p>
  </div>
</div>`
    );

    return NextResponse.json({ success: true, message: "Alarm trigger zala! Email pathavlay!" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { sendAdminEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const { name, company, phone, email, plan, message } = await req.json();
    if (!name || !phone || !email) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

    const html = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0f172a;padding:0;border-radius:12px;overflow:hidden">
  <div style="background:linear-gradient(135deg,#ca8a04,#eab308);padding:20px 28px">
    <h2 style="color:#050508;margin:0;font-size:18px">🚀 New Free Trial Request</h2>
    <p style="color:#050508;margin:4px 0 0;font-size:13px;opacity:0.7">City Real Space CRM</p>
  </div>
  <div style="background:#1e293b;padding:24px 28px">
    <table style="width:100%;border-collapse:collapse">
      <tr><td style="padding:8px 0;color:#94a3b8;font-size:13px;width:120px">Name</td><td style="padding:8px 0;color:#fff;font-size:14px;font-weight:600">${name}</td></tr>
      <tr style="background:rgba(255,255,255,0.03)"><td style="padding:8px 0;color:#94a3b8;font-size:13px">Company</td><td style="padding:8px 0;color:#e2e8f0;font-size:14px">${company || "—"}</td></tr>
      <tr><td style="padding:8px 0;color:#94a3b8;font-size:13px">Phone</td><td style="padding:8px 0;color:#eab308;font-size:14px;font-weight:600">${phone}</td></tr>
      <tr style="background:rgba(255,255,255,0.03)"><td style="padding:8px 0;color:#94a3b8;font-size:13px">Email</td><td style="padding:8px 0;color:#e2e8f0;font-size:14px">${email}</td></tr>
      <tr><td style="padding:8px 0;color:#94a3b8;font-size:13px">Plan</td><td style="padding:8px 0;color:#10b981;font-size:14px;font-weight:600">${plan}</td></tr>
      ${message ? `<tr style="background:rgba(255,255,255,0.03)"><td style="padding:8px 0;color:#94a3b8;font-size:13px">Message</td><td style="padding:8px 0;color:#e2e8f0;font-size:14px">${message}</td></tr>` : ""}
    </table>
    <div style="margin-top:20px;padding:12px 16px;background:rgba(234,179,8,0.08);border:1px solid rgba(234,179,8,0.2);border-radius:8px">
      <p style="color:#eab308;font-size:13px;margin:0">⚡ Contact within 2 hours to convert this lead!</p>
    </div>
  </div>
  <div style="background:#0f172a;padding:12px 28px;text-align:center">
    <p style="color:#475569;font-size:11px;margin:0">City Real Space CRM · cityrealspace.com</p>
  </div>
</div>`;

    await sendAdminEmail(`🚀 Free Trial Request — ${name} (${plan})`, html);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[FREE-TRIAL]", err);
    return NextResponse.json({ error: "Failed to send" }, { status: 500 });
  }
}

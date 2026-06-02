import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import https from "https";

const SECRET  = process.env.CLERK_SECRET_KEY!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://cityrealspacecrm.com";

function clerkREST(method: string, path: string, body?: object): Promise<any> {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : undefined;
    const req  = https.request({
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

// GET — admin clicks approve/deny link from email
export async function GET(req: NextRequest) {
  const id     = req.nextUrl.searchParams.get("id");
  const action = req.nextUrl.searchParams.get("action");
  const poll   = req.nextUrl.searchParams.get("poll");
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://cityrealspacecrm.com";

  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  // poll=1 means employee is polling for status
  if (poll === "1") {
    const record = await prisma.overtimeApproval.findUnique({ where: { id } });
    if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (new Date() > record.expiresAt) return NextResponse.json({ status: "EXPIRED" });
    return NextResponse.json({ status: record.status, token: record.token ?? null });
  }

  // Admin clicking approve/deny from email
  if (!action) return NextResponse.json({ error: "action required" }, { status: 400 });

  const record = await prisma.overtimeApproval.findUnique({ where: { id } });
  if (!record) {
    return new Response(`<html><body style="font-family:Arial;text-align:center;padding:60px;background:#0f172a;color:#fff"><h2>❌ Request not found</h2></body></html>`, { headers: { "Content-Type": "text/html" } });
  }
  if (record.status !== "PENDING") {
    return new Response(`<html><body style="font-family:Arial;text-align:center;padding:60px;background:#0f172a;color:#fff"><h2>${record.status === "APPROVED" ? "✅ Already Approved" : "❌ Already Denied"}</h2><p style="color:#94a3b8">This request was already processed.</p></body></html>`, { headers: { "Content-Type": "text/html" } });
  }
  if (new Date() > record.expiresAt) {
    return new Response(`<html><body style="font-family:Arial;text-align:center;padding:60px;background:#0f172a;color:#fff"><h2>⏰ Request Expired</h2><p style="color:#94a3b8">This approval link has expired.</p></body></html>`, { headers: { "Content-Type": "text/html" } });
  }

  if (action === "APPROVED") {
    const list  = await clerkREST("GET", `/v1/users?email_address=${encodeURIComponent(record.empEmail)}`);
    const users = list.data ?? list;
    if (!users.length) {
      return new Response(`<html><body style="font-family:Arial;text-align:center;padding:60px;background:#0f172a;color:#fff"><h2>❌ Employee not found</h2></body></html>`, { headers: { "Content-Type": "text/html" } });
    }
    const tokenRes = await clerkREST("POST", `/v1/sign_in_tokens`, { user_id: users[0].id, expires_in_seconds: 300 });
    if (tokenRes.errors || !tokenRes.token) {
      return new Response(`<html><body style="font-family:Arial;text-align:center;padding:60px;background:#0f172a;color:#fff"><h2>❌ Failed to create token</h2></body></html>`, { headers: { "Content-Type": "text/html" } });
    }
    await prisma.overtimeApproval.update({ where: { id }, data: { status: "APPROVED", token: tokenRes.token, approvedAt: new Date() } });
    try {
      const admins = await prisma.user.findMany({ where: { role: "ADMIN", isActive: true }, select: { id: true } });
      await Promise.all(admins.map(a => prisma.notification.create({ data: { userId: a.id, type: "SYSTEM", title: "Overtime Approved", message: `After-hours login approved for ${record.empName}` } })));
    } catch {}
    return new Response(`<html><body style="font-family:Arial;text-align:center;padding:60px;background:#0f172a;color:#fff"><h2 style="color:#4ade80">✅ Approved!</h2><p style="color:#94a3b8">${record.empName} can now log in to CRM.</p><p style="color:#64748b;font-size:13px">This approval is valid for 5 minutes.</p></body></html>`, { headers: { "Content-Type": "text/html" } });
  }

  // DENIED
  await prisma.overtimeApproval.update({ where: { id }, data: { status: "DENIED", deniedAt: new Date() } });
  return new Response(`<html><body style="font-family:Arial;text-align:center;padding:60px;background:#0f172a;color:#fff"><h2 style="color:#f87171">❌ Denied</h2><p style="color:#94a3b8">${record.empName}'s after-hours login request has been denied.</p></body></html>`, { headers: { "Content-Type": "text/html" } });
}

// POST — admin approves or denies
export async function POST(req: NextRequest) {
  const { id, action } = await req.json();
  if (!id || !action) return NextResponse.json({ error: "id and action required" }, { status: 400 });

  const record = await prisma.overtimeApproval.findUnique({ where: { id } });
  if (!record)              return NextResponse.json({ error: "Request not found" }, { status: 404 });
  if (record.status !== "PENDING") return NextResponse.json({ error: "Already processed" }, { status: 400 });
  if (new Date() > record.expiresAt) return NextResponse.json({ error: "Request expired" }, { status: 400 });

  if (action === "APPROVED") {
    const list  = await clerkREST("GET", `/v1/users?email_address=${encodeURIComponent(record.empEmail)}`);
    const users = list.data ?? list;
    if (!users.length) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

    const tokenRes = await clerkREST("POST", `/v1/sign_in_tokens`, {
      user_id: users[0].id,
      expires_in_seconds: 300,
    });
    if (tokenRes.errors || !tokenRes.token)
      return NextResponse.json({ error: "Failed to create login token" }, { status: 500 });

    await prisma.overtimeApproval.update({
      where: { id },
      data:  { status: "APPROVED", token: tokenRes.token, approvedAt: new Date() },
    });

    // DB notification to admins
    try {
      const admins = await prisma.user.findMany({ where: { role: "ADMIN", isActive: true }, select: { id: true } });
      await Promise.all(admins.map(a =>
        prisma.notification.create({
          data: { userId: a.id, type: "SYSTEM", title: `Overtime Approved`, message: `After-hours login approved for ${record.empName}` },
        })
      ));
    } catch {}

    return NextResponse.json({ success: true, status: "APPROVED" });
  }

  await prisma.overtimeApproval.update({
    where: { id },
    data:  { status: "DENIED", deniedAt: new Date() },
  });
  return NextResponse.json({ success: true, status: "DENIED" });
}

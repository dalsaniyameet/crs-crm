import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import https from "https";

const CLERK_SECRET = process.env.CLERK_SECRET_KEY!;

function clerkREST(method: string, path: string, body?: object): Promise<any> {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : undefined;
    const req = https.request({
      hostname: "api.clerk.com", path, method,
      headers: {
        Authorization: `Bearer ${CLERK_SECRET}`,
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
    const { userId } = auth();
    if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { email, password } = await req.json();
    if (!email || !password) return NextResponse.json({ error: "email and password required" }, { status: 400 });

    const emp = await prisma.employeeProfile.findUnique({ where: { email } });
    if (!emp) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

    // Find or create Clerk user via REST API
    const list = await clerkREST("GET", `/v1/users?email_address=${encodeURIComponent(email)}`);
    const existing = list.data ?? list;

    let clerkId: string;
    if (existing.length > 0) {
      const updated = await clerkREST("PATCH", `/v1/users/${existing[0].id}`, {
        password, skip_password_checks: true,
      });
      if (updated.errors) throw new Error(updated.errors[0]?.message || "Clerk update failed");
      clerkId = updated.id;
    } else {
      const [firstName, ...rest] = emp.name.trim().split(" ");
      const created = await clerkREST("POST", "/v1/users", {
        email_address: [email], password,
        first_name: firstName, last_name: rest.join(" ") || "",
        public_metadata: { role: emp.role },
        skip_password_checks: true,
      });
      if (created.errors) throw new Error(created.errors[0]?.message || "Clerk create failed");
      clerkId = created.id;
    }

    // Sync DB
    const byEmail = await prisma.user.findUnique({ where: { email } });
    if (byEmail) {
      await prisma.user.update({ where: { email }, data: { clerkId, role: emp.role } });
    } else {
      await prisma.user.create({ data: { clerkId, name: emp.name, email, role: emp.role } });
    }
    await prisma.employeeProfile.update({ where: { email }, data: { password } });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Reset password error:", err?.message);
    return NextResponse.json({ error: err?.message || "Failed" }, { status: 500 });
  }
}

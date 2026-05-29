import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import https from "https";

const SECRET = process.env.CLERK_SECRET_KEY!;

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
    }, res => { let raw = ""; res.on("data", c => raw += c); res.on("end", () => { try { resolve(JSON.parse(raw)); } catch { resolve({}); } }); });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (secret !== "crs-fix-2024") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const adminEmails = (process.env.ADMIN_EMAILS || "")
    .split(",").map(e => e.trim().toLowerCase()).filter(Boolean);

  const results: any[] = [];

  for (const email of adminEmails) {
    const result: any = { email, dbFixed: false, clerkFixed: false, error: null };

    try {
      // 1. Fix DB role
      const dbUser = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true, clerkId: true } });
      if (dbUser) {
        if (dbUser.role !== "ADMIN") {
          await prisma.user.update({ where: { email }, data: { role: "ADMIN" } });
          result.dbFixed = true;
          result.dbPrev = dbUser.role;
        } else {
          result.dbFixed = "already ADMIN";
        }

        // 2. Fix Clerk publicMetadata
        if (dbUser.clerkId) {
          await clerkREST("PATCH", `/v1/users/${dbUser.clerkId}`, {
            public_metadata: { role: "ADMIN" },
          });
          result.clerkFixed = true;
        }
      } else {
        // Try to find in Clerk and create in DB
        const clerkRes = await clerkREST("GET", `/v1/users?email_address=${encodeURIComponent(email)}`);
        const users = clerkRes.data ?? clerkRes ?? [];
        if (users.length > 0) {
          const cu = users[0];
          const name = [cu.first_name, cu.last_name].filter(Boolean).join(" ") || "Admin";
          await prisma.user.upsert({
            where:  { clerkId: cu.id },
            update: { role: "ADMIN", email, name },
            create: { clerkId: cu.id, email, name, role: "ADMIN", avatar: cu.image_url },
          });
          await clerkREST("PATCH", `/v1/users/${cu.id}`, { public_metadata: { role: "ADMIN" } });
          result.dbFixed = "created";
          result.clerkFixed = true;
        } else {
          result.error = "User not found in DB or Clerk";
        }
      }
    } catch (e: any) {
      result.error = e.message;
    }

    results.push(result);
  }

  return NextResponse.json({
    message: "Done! Refresh your browser and try again.",
    adminEmails,
    results,
  });
}

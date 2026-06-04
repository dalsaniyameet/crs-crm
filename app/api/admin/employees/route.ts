import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

async function getClerk() {
  return await clerkClient();
}

async function checkAdmin(userId: string): Promise<boolean> {
  // Check DB first
  const dbUser = await prisma.user.findUnique({ where: { clerkId: userId }, select: { role: true, email: true } });
  if (dbUser?.role?.toUpperCase() === "ADMIN") return true;

  // Check Clerk metadata
  try {
    const clerk = await getClerk();
    const u = await clerk.users.getUser(userId);
    const clerkRole = (u.publicMetadata?.role as string)?.toUpperCase();
    const email = u.emailAddresses?.[0]?.emailAddress || "";
    const adminEmails = (process.env.ADMIN_EMAILS || "").split(",").map(e => e.trim().toLowerCase());
    const isAdmin = clerkRole === "ADMIN" || adminEmails.includes(email.toLowerCase());

    // Auto-create/fix user in DB if missing
    if (isAdmin) {
      const name = [u.firstName, u.lastName].filter(Boolean).join(" ") || "Admin";
      await prisma.user.upsert({
        where:  { clerkId: userId },
        update: { role: "ADMIN", email, name },
        create: { clerkId: userId, email, name, role: "ADMIN", avatar: u.imageUrl },
      }).catch(() => {});
    }
    return isAdmin;
  } catch { return false; }
}

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (!(await checkAdmin(userId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const id = new URL(req.url).searchParams.get("id");
    if (id) {
      const emp = await prisma.employeeProfile.findUnique({ where: { id } });
      return NextResponse.json(emp || null);
    }
    const employees = await prisma.employeeProfile.findMany({ orderBy: { createdAt: "desc" } });
    return NextResponse.json(employees);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (!(await checkAdmin(userId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    let body;
    try {
      body = await req.json();
    } catch (parseErr: any) {
      console.error("[Employee POST] JSON parse error:", parseErr.message);
      return NextResponse.json({ error: "Invalid JSON format", details: parseErr.message }, { status: 400 });
    }
    
    console.log("[Employee POST] Received body:", JSON.stringify(body, null, 2));
    
    const { name, email, dob, position, role, avatarUrl, password: customPassword, id: empId, isActive } = body;
    
    // Validate required fields with detailed error
    if (!name?.trim())
      return NextResponse.json({ error: "Full Name is required" }, { status: 400 });
    if (!email?.trim())
      return NextResponse.json({ error: "Work Email is required" }, { status: 400 });
    if (!position?.trim())
      return NextResponse.json({ error: "Position is required" }, { status: 400 });

    const clerk = await getClerk();

    if (empId) {
      const updated = await prisma.employeeProfile.update({
        where: { id: empId },
        data: {
          ...(avatarUrl !== undefined && { avatarUrl }),
          ...(role      !== undefined && { role }),
          ...(isActive  !== undefined && { isActive }),
          name, position,
        },
      });
      // Sync name + avatar to User table
      await prisma.user.updateMany({
        where: { email },
        data: {
          name,
          ...(avatarUrl !== undefined && { avatar: avatarUrl }),
          ...(role      !== undefined && { role }),
        },
      });
      // Sync name + role to Clerk
      try {
        const clerkList = await clerk.users.getUserList({ emailAddress: [email] });
        const clerkUsers = Array.isArray(clerkList) ? clerkList : (clerkList as any).data ?? [];
        if (clerkUsers.length > 0) {
          const [firstName, ...rest] = name.trim().split(" ");
          await clerk.users.updateUser(clerkUsers[0].id, {
            firstName,
            lastName: rest.join(" ") || undefined,
            ...(role !== undefined && { publicMetadata: { role } }),
          });
        }
      } catch { /* non-critical */ }
      return NextResponse.json(updated);
    }

    if (!customPassword?.trim())
      return NextResponse.json({ error: "Password required" }, { status: 400 });

    const dobDate = dob ? new Date(dob) : new Date("2000-01-01");
    const password = customPassword.trim();
    const [firstName, ...rest] = name.trim().split(" ");
    const lastName = rest.join(" ") || "";

    let clerkUser;
    try {
      const existingRaw = await clerk.users.getUserList({ emailAddress: [email] });
      const existingList = Array.isArray(existingRaw) ? existingRaw : (existingRaw as any).data ?? [];
      if (existingList.length > 0) {
        clerkUser = await clerk.users.updateUser(existingList[0].id, {
          password, firstName, lastName,
          publicMetadata: { role: role || "BROKER" },
          skipPasswordChecks: true,
        } as any);
      } else {
        clerkUser = await clerk.users.createUser({
          emailAddress: [email.trim()], password, firstName, lastName,
          publicMetadata: { role: role || "BROKER" },
          skipPasswordChecks: true,
          ...(avatarUrl ? { profileImageUrl: avatarUrl } : {}),
        } as any);
      }
    } catch (err: any) {
      const msg  = err?.errors?.[0]?.message || err?.message || "Failed to create account";
      const code = err?.errors?.[0]?.code    || "";
      console.error("Clerk error:", JSON.stringify(err?.errors || err?.message));
      if (code === "form_password_pwned" || msg.toLowerCase().includes("breach"))
        return NextResponse.json({ error: "Password too common. Use stronger password like Meet@1234." }, { status: 400 });
      if (code === "form_identifier_exists" || msg.toLowerCase().includes("taken") || msg.toLowerCase().includes("exists")) {
        try {
          const retryRaw = await clerk.users.getUserList({ emailAddress: [email] });
          const retryList = Array.isArray(retryRaw) ? retryRaw : (retryRaw as any).data ?? [];
          if (retryList.length > 0) {
            clerkUser = await clerk.users.updateUser(retryList[0].id, {
              password, firstName, lastName, publicMetadata: { role: role || "BROKER" },
              skipPasswordChecks: true,
            } as any);
          } else return NextResponse.json({ error: msg }, { status: 400 });
        } catch { return NextResponse.json({ error: msg }, { status: 400 }); }
      } else return NextResponse.json({ error: msg }, { status: 400 });
    }

    const employee = await prisma.employeeProfile.upsert({
      where:  { email },
      update: { name, dob: dobDate, position, role: role || "BROKER", avatarUrl: avatarUrl || null, password, isActive: true },
      create: { name, email, dob: dobDate, position, role: role || "BROKER", avatarUrl: avatarUrl || null, password },
    });

    const existingByEmail = await prisma.user.findUnique({ where: { email } });
    if (existingByEmail && existingByEmail.clerkId !== clerkUser.id) {
      await prisma.user.update({ where: { email }, data: { clerkId: clerkUser.id, name, role: role || "BROKER", avatar: avatarUrl || null } });
    } else {
      await prisma.user.upsert({
        where:  { clerkId: clerkUser.id },
        update: { name, email, role: role || "BROKER", avatar: avatarUrl || null },
        create: { clerkId: clerkUser.id, name, email, role: role || "BROKER", avatar: avatarUrl || null },
      });
    }
    return NextResponse.json(employee, { status: 201 });
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    const errorStack = err?.stack || "N/A";
    console.error("[Employee POST] Full error:", { message: errorMsg, stack: errorStack, error: err });
    return NextResponse.json({ 
      error: errorMsg || "Failed to add employee",
      details: process.env.NODE_ENV === 'development' ? errorStack : undefined
    }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (!(await checkAdmin(userId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await req.json();
    const emp = await prisma.employeeProfile.findUnique({ where: { id } });
    if (!emp) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const clerk = await getClerk();
    const dbUser = await prisma.user.findUnique({ where: { email: emp.email } });
    if (dbUser?.clerkId) {
      await clerk.users.deleteUser(dbUser.clerkId).catch(() => {});
      await prisma.user.delete({ where: { email: emp.email } }).catch(() => {});
    }
    await prisma.leaveRequest.deleteMany({ where: { employeeId: id } }).catch(() => {});
    await prisma.employeeProfile.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed" }, { status: 500 });
  }
}

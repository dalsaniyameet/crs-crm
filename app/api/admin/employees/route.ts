import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { clerkClient } from "@clerk/nextjs";
import { prisma } from "@/lib/prisma";

async function isAdmin(userId: string) {
  const u = await clerkClient.users.getUser(userId);
  return (u.publicMetadata?.role as string)?.toUpperCase() === "ADMIN";
}

// GET — list all employees OR single by id
export async function GET(req: NextRequest) {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Check role from DB first (faster than Clerk API)
  const dbUser = await prisma.user.findUnique({ where: { clerkId: userId }, select: { role: true } });
  if (!dbUser || dbUser.role?.toUpperCase() !== "ADMIN") {
    // Fallback to Clerk
    const ok = await isAdmin(userId);
    if (!ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const id = new URL(req.url).searchParams.get("id");
  if (id) {
    const emp = await prisma.employeeProfile.findUnique({ where: { id } });
    return NextResponse.json(emp || null);
  }

  const employees = await prisma.employeeProfile.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(employees);
}

// POST — add new employee + create Clerk account
export async function POST(req: NextRequest) {
  try {
    const { userId } = auth();
    if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const dbUser2 = await prisma.user.findUnique({ where: { clerkId: userId }, select: { role: true } });
    const adminOk = dbUser2?.role?.toUpperCase() === "ADMIN" || await isAdmin(userId);
    if (!adminOk) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const { name, email, dob, position, role, avatarUrl, password: customPassword, id: empId, isActive } = body;
    if (!name || !email || !position)
      return NextResponse.json({ error: "name, email, position required" }, { status: 400 });

    // ── Update-only path (photo / role / status change — no password needed) ──
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
      // sync avatar to User table too
      if (avatarUrl !== undefined) {
        await prisma.user.updateMany({ where: { email }, data: { avatar: avatarUrl } });
      }
      // sync role to Clerk + User
      if (role !== undefined) {
        const clerkUsers = await clerkClient.users.getUserList({ emailAddress: [email] });
        const clerkUserList = Array.isArray(clerkUsers) ? clerkUsers : (clerkUsers as any).data ?? [];
        if (clerkUserList.length > 0)
          await clerkClient.users.updateUser(clerkUserList[0].id, { publicMetadata: { role } });
        await prisma.user.updateMany({ where: { email }, data: { role } });
      }
      return NextResponse.json(updated);
    }

    if (!customPassword?.trim())
      return NextResponse.json({ error: "Password required" }, { status: 400 });

    const dobDate = dob ? new Date(dob) : new Date("2000-01-01");
    const password = customPassword.trim();

    const [firstName, ...rest] = name.trim().split(" ");
    const lastName = rest.join(" ") || "";

    // Create or update Clerk user
    let clerkUser;
    try {
      // Check if user already exists in Clerk
      const existingRaw = await clerkClient.users.getUserList({ emailAddress: [email] });
      const existingList = Array.isArray(existingRaw) ? existingRaw : (existingRaw as any).data ?? [];
      const existingCount = Array.isArray(existingRaw) ? existingRaw.length : ((existingRaw as any).totalCount ?? existingList.length);
      if (existingCount > 0) {
        clerkUser = await clerkClient.users.updateUser(existingList[0].id, {
          password, firstName, lastName,
          publicMetadata: { role: role || "BROKER" },
          skip_password_checks: true,
          skip_password_requirement: true,
        } as any);
      } else {
        clerkUser = await clerkClient.users.createUser({
          emailAddress: [email],
          password, firstName, lastName,
          publicMetadata: { role: role || "BROKER" },
          skip_password_checks: true,
          skip_password_requirement: true,
          ...(avatarUrl ? { profileImageUrl: avatarUrl } : {}),
        } as any);
      }
    } catch (err: unknown) {
      const clerkErr = err as { errors?: Array<{ message: string; code: string }> };
      const msg  = clerkErr?.errors?.[0]?.message || "Failed to create account";
      const code = clerkErr?.errors?.[0]?.code    || "";
      if (code === "form_password_pwned" || msg.toLowerCase().includes("breach"))
        return NextResponse.json({ error: "Password is too common. Use a stronger password (e.g. Meet@303 style)." }, { status: 400 });
      if (code === "form_identifier_exists" || msg.toLowerCase().includes("taken") || msg.toLowerCase().includes("exists")) {
        // Clerk user exists but getUserList missed it — fetch by email and update
        try {
          const retryRaw = await clerkClient.users.getUserList({ emailAddress: [email] });
          const retryList = Array.isArray(retryRaw) ? retryRaw : (retryRaw as any).data ?? [];
          if (retryList.length > 0) {
            clerkUser = await clerkClient.users.updateUser(retryList[0].id, {
              password, firstName, lastName, publicMetadata: { role: role || "BROKER" },
              skip_password_checks: true, skip_password_requirement: true,
            } as any);
          } else {
            return NextResponse.json({ error: msg }, { status: 400 });
          }
        } catch {
          return NextResponse.json({ error: msg }, { status: 400 });
        }
      } else {
        return NextResponse.json({ error: msg }, { status: 400 });
      }
    }

    // Save to DB — upsert in case employee was added before
    const employee = await prisma.employeeProfile.upsert({
      where:  { email },
      update: { name, dob: dobDate, position, role: role || "BROKER", avatarUrl: avatarUrl || null, password, isActive: true },
      create: { name, email, dob: dobDate, position, role: role || "BROKER", avatarUrl: avatarUrl || null, password },
    });

    // upsert by clerkId, but also handle email conflict
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
    console.error("Add employee error:", err?.message);
    return NextResponse.json({ error: err?.message || "Failed to add employee" }, { status: 500 });
  }
}

// DELETE — remove employee
export async function DELETE(req: NextRequest) {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const dbUser3 = await prisma.user.findUnique({ where: { clerkId: userId }, select: { role: true } });
  const adminOk2 = dbUser3?.role?.toUpperCase() === "ADMIN" || await isAdmin(userId);
  if (!adminOk2) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await req.json();
  const emp = await prisma.employeeProfile.findUnique({ where: { id } });
  if (!emp) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Try to delete Clerk user — ignore if already deleted
  const dbUser = await prisma.user.findUnique({ where: { email: emp.email } });
  if (dbUser?.clerkId) {
    await clerkClient.users.deleteUser(dbUser.clerkId).catch(() => {});
    await prisma.user.delete({ where: { email: emp.email } }).catch(() => {});
  }

  // Hard delete from DB
  await prisma.leaveRequest.deleteMany({ where: { employeeId: id } }).catch(() => {});
  await prisma.employeeProfile.delete({ where: { id } });
  return NextResponse.json({ success: true });
}

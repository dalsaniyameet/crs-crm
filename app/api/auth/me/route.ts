import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { id: true, clerkId: true, name: true, email: true, phone: true, role: true, avatar: true },
  });
  return NextResponse.json(user ?? {});
}

export async function PATCH(req: NextRequest) {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const data: Record<string, string> = {};

  if (body.name)   data.name   = body.name;
  if (body.phone)  data.phone  = body.phone;
  if (body.avatar) data.avatar = body.avatar;

  const clerkUser = await clerkClient.users.getUser(userId);
  const email = clerkUser.emailAddresses[0]?.emailAddress;

  await prisma.user.updateMany({ where: { clerkId: userId }, data });
  if (email) await prisma.user.updateMany({ where: { email }, data });

  // Sync name to Clerk as well
  if (body.name) {
    const [firstName, ...rest] = body.name.trim().split(" ");
    await clerkClient.users.updateUser(userId, {
      firstName,
      lastName: rest.join(" ") || undefined,
    }).catch(() => {});
  }

  return NextResponse.json({ success: true });
}

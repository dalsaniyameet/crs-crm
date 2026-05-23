import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json(null);

    const clerk = await clerkClient();
    const clerkUser = await clerk.users.getUser(userId);
    const email = clerkUser.emailAddresses[0]?.emailAddress;
    if (!email) return NextResponse.json(null);

    const today = new Date(); today.setHours(0, 0, 0, 0);

    const record = await prisma.guestAttendance.findFirst({
      where: { phone: email, punchOut: null, punchIn: { gte: today } },
      orderBy: { punchIn: "desc" },
    });

    return NextResponse.json(record || null);
  } catch {
    return NextResponse.json(null);
  }
}

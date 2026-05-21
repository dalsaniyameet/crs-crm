import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const { userId } = auth();

    if (!userId) {
      return NextResponse.json({
        qrData: JSON.stringify({ type: "CRS_ATTENDANCE", ts: Date.now() }),
      });
    }

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });

    const qrData = JSON.stringify({
      type:   "CRS_ATTENDANCE",
      userId: user?.id ?? userId,
      name:   user?.name ?? "Employee",
      email:  user?.email ?? "",
      ts:     Date.now(),
    });

    return NextResponse.json({ qrData, userName: user?.name ?? "Employee" });
  } catch (error: any) {
    console.error("QR error:", error?.message);
    return NextResponse.json({
      qrData: JSON.stringify({ type: "CRS_ATTENDANCE", ts: Date.now() }),
    });
  }
}

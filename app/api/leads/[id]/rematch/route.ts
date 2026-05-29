import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { autoMatchProperties } from "@/lib/autoMatch";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await autoMatchProperties(params.id);
  return NextResponse.json({ success: true });
}

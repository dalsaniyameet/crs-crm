import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const numbers = await prisma.wpNumber.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json(numbers);
}

export async function POST(req: NextRequest) {
  try {
    const { number, label } = await req.json();
    const wp = await prisma.wpNumber.upsert({
      where:  { number },
      update: { label },
      create: { number, label },
    });
    return NextResponse.json(wp, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

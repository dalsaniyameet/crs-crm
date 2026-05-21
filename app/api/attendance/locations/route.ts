import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const revalidate = 300; // cache 5 min

export async function GET() {
  try {
    const locations = await prisma.attendanceLocation.findMany({
      where:   { isActive: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(locations, {
      headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=60" },
    });
  } catch (error: unknown) {
    console.error("Locations error:", (error as Error)?.message);
    return NextResponse.json([]);
  }
}

export async function POST(req: Request) {
  try {
    const { name, address, latitude, longitude, radius } = await req.json();
    const location = await prisma.attendanceLocation.create({
      data: { name, address, latitude, longitude, radius: radius || 100 },
    });
    return NextResponse.json(location);
  } catch (error: unknown) {
    console.error("Create location error:", (error as Error)?.message);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

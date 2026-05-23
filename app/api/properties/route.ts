import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { autoMatchProperties } from "@/lib/autoMatch";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category        = searchParams.get("category");
    const type            = searchParams.get("type");
    const status          = searchParams.get("status");
    const locality        = searchParams.get("locality");
    const minPrice        = searchParams.get("minPrice");
    const maxPrice        = searchParams.get("maxPrice");
    const transactionType = searchParams.get("transactionType");
    const page            = parseInt(searchParams.get("page")  || "1");
    const limit           = parseInt(searchParams.get("limit") || "20");

    const where: Record<string, unknown> = {};
    if (category)        where.category        = category;
    if (type)            where.type            = type;
    if (status)          where.status          = status;
    if (locality)        where.locality        = { contains: locality, mode: "insensitive" };
    if (transactionType) where.transactionType = transactionType;
    if (minPrice || maxPrice) {
      const price: Record<string, number> = {};
      if (minPrice) price.gte = parseFloat(minPrice);
      if (maxPrice) price.lte = parseFloat(maxPrice);
      where.price = price;
    }

    const [properties, total] = await Promise.all([
      prisma.property.findMany({
        where,
        select: {
          id: true, title: true, type: true, category: true, status: true,
          locality: true, city: true, price: true, area: true, carpetArea: true,
          transactionType: true, isFeatured: true, isVerified: true,
          photos: true, amenities: true, commissionRate: true,
          ownerName: true, ownerPhone: true, viewCount: true,
          createdAt: true,
          listedBy: { select: { id: true, name: true } },
          _count:   { select: { matchedLeads: true } },
        },
        orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.property.count({ where }),
    ]);

    return NextResponse.json({ properties, total, page, pages: Math.ceil(total / limit) }, {
      headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" },
    });
  } catch (err: any) {
    console.error("Properties GET error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { commercial, residential, ...propertyData } = body;

    const existing = await prisma.property.findFirst({
      where: {
        title:    { equals: propertyData.title,    mode: "insensitive" },
        locality: { equals: propertyData.locality, mode: "insensitive" },
      },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Possible duplicate property", existingProperty: existing, isDuplicate: true },
        { status: 409 }
      );
    }

    const property = await prisma.property.create({
      data: {
        ...propertyData,
        commercial:  commercial  ? { create: commercial  } : undefined,
        residential: residential ? { create: residential } : undefined,
      },
      include: { commercial: true, residential: true },
    });

    return NextResponse.json(property, { status: 201 });
  } catch (err: any) {
    console.error("Properties POST error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

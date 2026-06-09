import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const ownerId = searchParams.get("ownerId");
    const where = ownerId ? { ownerId } : {};
    const items = await prisma.ownerStore.findMany({
      where,
      include: { owner: { select: { id: true, name: true, phone: true, locality: true } } },
      orderBy: { listedAt: "desc" },
    });
    return NextResponse.json(items);
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const item = await prisma.ownerStore.create({
      data: {
        ownerId:         body.ownerId,
        title:           body.title           || "Untitled",
        propertyType:    body.propertyType    || null,
        transactionType: body.transactionType || null,
        price:           body.price           ? Number(body.price) : null,
        area:            body.area            ? Number(body.area)  : null,
        floor:           body.floor           || null,
        locality:        body.locality        || null,
        address:         body.address         || null,
        furnishing:      body.furnishing      || null,
        status:          body.status          || "AVAILABLE",
        imageUrl:        body.imageUrl        || null,
        notes:           body.notes           || null,
        listedAt:        body.listedAt        ? new Date(body.listedAt) : new Date(),
      },
      include: { owner: { select: { id: true, name: true, phone: true, locality: true } } },
    });
    return NextResponse.json(item, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    const body = await req.json();
    const item = await prisma.ownerStore.update({
      where: { id },
      data: {
        title:           body.title           ?? undefined,
        propertyType:    body.propertyType    ?? undefined,
        transactionType: body.transactionType ?? undefined,
        price:           body.price !== undefined ? (body.price ? Number(body.price) : null) : undefined,
        area:            body.area  !== undefined ? (body.area  ? Number(body.area)  : null) : undefined,
        floor:           body.floor           ?? undefined,
        locality:        body.locality        ?? undefined,
        address:         body.address         ?? undefined,
        furnishing:      body.furnishing      ?? undefined,
        status:          body.status          ?? undefined,
        imageUrl:        body.imageUrl        ?? undefined,
        notes:           body.notes           ?? undefined,
        listedAt:        body.listedAt ? new Date(body.listedAt) : undefined,
      },
      include: { owner: { select: { id: true, name: true, phone: true, locality: true } } },
    });
    return NextResponse.json(item);
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    await prisma.ownerStore.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

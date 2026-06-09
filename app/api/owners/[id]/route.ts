import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const owner = await prisma.propertyOwner.findUnique({
      where: { id: params.id },
      include: { properties: { select: { id: true, title: true, status: true, price: true, type: true, transactionType: true } } },
    });
    if (!owner) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(owner);
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const data  = await req.json();

    // photos array ke liye special handling — append mode support
    if (data._addPhotos) {
      const existing = await prisma.propertyOwner.findUnique({ where: { id: params.id }, select: { photos: true } });
      const merged   = [...(existing?.photos || []), ...data._addPhotos];
      const owner    = await prisma.propertyOwner.update({
        where: { id: params.id },
        data: { photos: merged },
      });
      return NextResponse.json(owner);
    }

    const { _addPhotos: _, ...rest } = data;
    const owner = await prisma.propertyOwner.update({ where: { id: params.id }, data: rest });
    return NextResponse.json(owner);
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    await prisma.propertyOwner.update({ where: { id: params.id }, data: { isActive: false } });
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

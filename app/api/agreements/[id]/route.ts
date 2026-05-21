import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const agreement = await prisma.agreement.update({
    where: { id: params.id },
    data: {
      ...body,
      signedAt:   body.signedAt   ? new Date(body.signedAt)   : undefined,
      expiryDate: body.expiryDate ? new Date(body.expiryDate) : undefined,
    },
  });
  return NextResponse.json(agreement);
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.agreement.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}

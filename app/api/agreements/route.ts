import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const agreements = await prisma.agreement.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(agreements);
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const agreement = await prisma.agreement.create({
    data: {
      title:           body.title,
      type:            body.type,
      status:          body.status ?? "DRAFT",
      client:          body.client,
      clientPhone:     body.clientPhone,
      property:        body.property,
      dealValue:       parseFloat(body.dealValue),
      tokenAmount:     body.tokenAmount ? parseFloat(body.tokenAmount) : undefined,
      broker:          body.broker,
      stampDuty:       body.stampDuty ? parseFloat(body.stampDuty) : undefined,
      registrationFee: body.registrationFee ? parseFloat(body.registrationFee) : undefined,
      notes:           body.notes || undefined,
      expiryDate:      body.expiryDate ? new Date(body.expiryDate) : undefined,
    },
  });
  return NextResponse.json(agreement, { status: 201 });
}


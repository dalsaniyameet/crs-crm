import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "No webhook secret" }, { status: 500 });

  const svixId        = req.headers.get("svix-id") ?? "";
  const svixTimestamp = req.headers.get("svix-timestamp") ?? "";
  const svixSignature = req.headers.get("svix-signature") ?? "";

  const body = await req.text();

  let payload: { type: string; data: Record<string, unknown> };
  try {
    const wh = new Webhook(secret);
    payload  = wh.verify(body, {
      "svix-id":        svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as typeof payload;
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const { type, data } = payload;

  if (type === "user.created" || type === "user.updated") {
    const emailArr = data.email_addresses as Array<{ email_address: string }>;
    const phoneArr = data.phone_numbers  as Array<{ phone_number: string }> | undefined;
    const email    = emailArr?.[0]?.email_address ?? "";
    const name     = [data.first_name, data.last_name].filter(Boolean).join(" ") || "User";
    const phone    = phoneArr?.[0]?.phone_number ?? undefined;

    await prisma.user.upsert({
      where:  { clerkId: data.id as string },
      update: { email, name, avatar: data.image_url as string, phone },
      create: {
        clerkId: data.id as string,
        email, name,
        avatar: data.image_url as string,
        phone,
        role: "BROKER",
      },
    });
  }

  if (type === "user.deleted") {
    await prisma.user.updateMany({
      where: { clerkId: data.id as string },
      data:  { isActive: false },
    });
  }

  return NextResponse.json({ received: true });
}

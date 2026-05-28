import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { chatWithAssistant } from "@/lib/openai";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { message, context } = await req.json();
  const response = await chatWithAssistant(message, context ?? []);
  return NextResponse.json({ response });
}


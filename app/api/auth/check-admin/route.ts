import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

  const adminEmails = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map(e => e.trim().toLowerCase());

  if (!adminEmails.includes(email.toLowerCase()))
    return NextResponse.json({ error: "Not authorized as admin" }, { status: 403 });

  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const url    = new URL(req.url);
  const code   = url.searchParams.get("code");
  const error  = url.searchParams.get("error");
  const state  = url.searchParams.get("state"); // clerkId
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  if (error || !code) {
    console.error("[gcal callback] error param:", error);
    return NextResponse.redirect(`${appUrl}/settings?google=error`);
  }

  try {
    // 1. Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id:     process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri:  `${appUrl}/api/google/callback`,
        grant_type:    "authorization_code",
      }),
    });
    const tokens = await tokenRes.json();
    console.log("[gcal callback] token exchange:", tokenRes.status, tokens.error || "ok");

    if (!tokens.access_token) {
      return NextResponse.redirect(`${appUrl}/settings?google=error`);
    }

    // 2. Get Google profile
    const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = await profileRes.json();
    console.log("[gcal callback] google email:", profile.email);

    // 3. Find user — by clerkId (state) OR by google email
    let user = state
      ? await prisma.user.findFirst({ where: { clerkId: state } })
      : null;

    if (!user && profile.email) {
      user = await prisma.user.findFirst({ where: { email: profile.email } });
    }

    console.log("[gcal callback] user found:", user?.id, user?.email);

    if (!user) {
      console.error("[gcal callback] no user found for state:", state, "email:", profile.email);
      return NextResponse.redirect(`${appUrl}/settings?google=error`);
    }

    // 4. Save token
    await prisma.activity.deleteMany({
      where: { userId: user.id, type: "GOOGLE_CALENDAR_TOKEN" },
    });
    await prisma.activity.create({
      data: {
        userId:      user.id,
        type:        "GOOGLE_CALENDAR_TOKEN",
        description: `Google Calendar connected: ${profile.email}`,
        metadata: {
          access_token:  tokens.access_token,
          refresh_token: tokens.refresh_token ?? null,
          expiry:        tokens.expires_in ? Date.now() + tokens.expires_in * 1000 : null,
          google_email:  profile.email,
        },
      },
    });

    console.log("[gcal callback] token saved for user:", user.id);
    return NextResponse.redirect(`${appUrl}/settings?google=success&email=${encodeURIComponent(profile.email)}`);

  } catch (err: any) {
    console.error("[gcal callback] exception:", err.message);
    return NextResponse.redirect(`${appUrl}/settings?google=error`);
  }
}

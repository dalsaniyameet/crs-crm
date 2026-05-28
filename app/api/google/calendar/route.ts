import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

async function getTokens(clerkId: string) {
  const user = await prisma.user.findFirst({ where: { clerkId } });
  if (!user) return null;
  const activity = await prisma.activity.findFirst({
    where: { userId: user.id, type: "GOOGLE_CALENDAR_TOKEN" },
    orderBy: { createdAt: "desc" },
  });
  return activity ? { ...(activity.metadata as any), _userId: user.id } : null;
}

async function refreshAccessToken(refreshToken: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id:     process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type:    "refresh_token",
    }),
  });
  return res.json();
}

// GET — check connection + list upcoming events
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ connected: false });

  const tokens = await getTokens(userId);
  if (!tokens?.access_token) return NextResponse.json({ connected: false });

  try {
    let accessToken = tokens.access_token;
    if (tokens.expiry && Date.now() > tokens.expiry - 60000 && tokens.refresh_token) {
      const refreshed = await refreshAccessToken(tokens.refresh_token);
      if (refreshed.access_token) accessToken = refreshed.access_token;
    }

    // Fetch 6 months of events (past 1 month + next 5 months)
    const timeMin = new Date();
    timeMin.setMonth(timeMin.getMonth() - 1);
    const timeMax = new Date();
    timeMax.setMonth(timeMax.getMonth() + 5);

    const eventsRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin.toISOString()}&timeMax=${timeMax.toISOString()}&maxResults=250&singleEvents=true&orderBy=startTime`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const eventsData = await eventsRes.json();

    return NextResponse.json({
      connected: true,
      email:  tokens.google_email,
      events: eventsData.items || [],
    });
  } catch {
    return NextResponse.json({ connected: false });
  }
}

// POST — create calendar event
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tokens = await getTokens(userId);
  if (!tokens?.access_token) return NextResponse.json({ error: "Google Calendar not connected" }, { status: 400 });

  const { title, description, startTime, endTime, attendeeEmail } = await req.json();

  let accessToken = tokens.access_token;
  if (tokens.expiry && Date.now() > tokens.expiry - 60000 && tokens.refresh_token) {
    const refreshed = await refreshAccessToken(tokens.refresh_token);
    if (refreshed.access_token) accessToken = refreshed.access_token;
  }

  const event = {
    summary:     title,
    description: description || "",
    start: { dateTime: startTime, timeZone: "Asia/Kolkata" },
    end:   { dateTime: endTime || new Date(new Date(startTime).getTime() + 3600000).toISOString(), timeZone: "Asia/Kolkata" },
    ...(attendeeEmail ? { attendees: [{ email: attendeeEmail }] } : {}),
    reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 30 }] },
  };

  const res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(event),
  });
  const data = await res.json();
  if (!res.ok) return NextResponse.json({ error: data.error?.message || "Failed" }, { status: 400 });
  return NextResponse.json({ success: true, eventId: data.id, link: data.htmlLink });
}

// DELETE — disconnect
export async function DELETE(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tokens = await getTokens(userId);
  if (tokens?._userId) {
    await prisma.activity.deleteMany({
      where: { userId: tokens._userId, type: "GOOGLE_CALENDAR_TOKEN" },
    });
  }
  return NextResponse.json({ success: true });
}


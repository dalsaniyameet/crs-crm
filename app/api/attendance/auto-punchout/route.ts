import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const CRON_SECRET = process.env.CRON_SECRET || "crs-cron-2024";

// Vercel Cron: 18:25 UTC = 23:55 IST daily
// vercel.json: { "crons": [{ "path": "/api/attendance/auto-punchout", "schedule": "25 18 * * *" }] }

export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret") || new URL(req.url).searchParams.get("secret");
  if (secret !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const stillIn = await prisma.guestAttendance.findMany({
    where: { punchOut: null, punchIn: { gte: today } },
  });

  if (stillIn.length === 0) {
    return NextResponse.json({ message: "No one to punch out", count: 0 });
  }

  const punchOut = new Date();
  const BREAK_MINUTES = 45;
  let count = 0;

  for (const record of stillIn) {
    const totalMs   = punchOut.getTime() - record.punchIn.getTime();
    const breakMs   = BREAK_MINUTES * 60 * 1000;
    const netMs     = totalMs > breakMs ? totalMs - breakMs : totalMs;
    const workHours = netMs / (1000 * 60 * 60);

    const punchInIST  = new Date(record.punchIn.getTime() + 5.5 * 60 * 60 * 1000);
    const isSun       = punchInIST.getUTCDay() === 0;
    const expectedMin = isSun ? 16 * 60 : 10 * 60;
    const actualMin   = punchInIST.getUTCHours() * 60 + punchInIST.getUTCMinutes();
    const lateMinutes = Math.max(0, actualMin - expectedMin);

    await prisma.guestAttendance.update({
      where: { id: record.id },
      data:  { punchOut, workHours, lateMinutes },
    });
    count++;
  }

  return NextResponse.json({ message: `Auto punched out ${count} employees`, count });
}

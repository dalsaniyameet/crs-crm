import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET — owner ke saare call history (daily reports se)
export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const owner = await prisma.propertyOwner.findUnique({
      where: { id: params.id },
      select: { phone: true, phone2: true },
    });
    if (!owner) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Match by ownerPhone field in callEntries JSON or by phone number
    const reports = await prisma.dailyReport.findMany({
      where: { isSubmitted: true },
      select: {
        id: true,
        date: true,
        employee: { select: { name: true } },
        callEntries: true,
      },
      orderBy: { date: "desc" },
      take: 100,
    });

    const ownerPhones = [owner.phone, owner.phone2].filter(Boolean).map(p => p!.replace(/\D/g, "").slice(-10));

    const calls: Array<{
      reportId: string;
      date: string;
      employeeName: string;
      ownerPhone: string;
      ownerName?: string;
      propertyDetails?: string;
      outcome: string;
      notes?: string;
      proofImageUrl?: string;
    }> = [];

    for (const report of reports) {
      let entries: any[] = [];
      try { entries = JSON.parse(report.callEntries as string || "[]"); } catch { continue; }

      for (const entry of entries) {
        const ep = (entry.ownerPhone || entry.phone || "").replace(/\D/g, "").slice(-10);
        if (ownerPhones.includes(ep)) {
          calls.push({
            reportId: report.id,
            date: report.date,
            employeeName: report.employee?.name || "Unknown",
            ownerPhone: ep,
            ownerName: entry.ownerName || entry.clientName,
            propertyDetails: entry.propertyDetails,
            outcome: entry.outcome || "CONNECTED",
            notes: entry.notes,
            proofImageUrl: entry.proofImageUrl,
          });
        }
      }
    }

    return NextResponse.json(calls);
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

// POST — manually log a call for this owner
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { employeeId, notes, outcome, propertyDetails } = await req.json();
    // Save as a message with call metadata
    const msg = await prisma.ownerMessage.create({
      data: {
        ownerId:   params.id,
        direction: "OUT",
        message:   `📞 Call logged${outcome ? ` — ${outcome}` : ""}${propertyDetails ? ` | Property: ${propertyDetails}` : ""}${notes ? `\n${notes}` : ""}`,
      },
    });
    return NextResponse.json(msg);
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

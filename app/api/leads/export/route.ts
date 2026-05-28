import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const leads = await prisma.lead.findMany({
    include: { assignedTo: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  const rows = leads.map((l, i) => ({
    "Sr.":           i + 1,
    "Name":          l.name,
    "Phone":         l.phone,
    "Email":         l.email ?? "",
    "Source":        l.source.replace(/_/g, " "),
    "Status":        l.status.replace(/_/g, " "),
    "AI Score":      l.score,
    "Budget (₹)":    l.budget ?? "",
    "Property Type": l.propertyType ?? "",
    "Transaction":   l.transactionType ?? "",
    "Requirements":  l.requirements ?? "",
    "Assigned To":   l.assignedTo?.name ?? "Unassigned",
    "Next Follow-up": l.nextFollowUpAt ? new Date(l.nextFollowUpAt).toLocaleDateString("en-IN") : "",
    "Added On":      new Date(l.createdAt).toLocaleDateString("en-IN"),
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [
    { wch: 5 }, { wch: 22 }, { wch: 14 }, { wch: 25 }, { wch: 16 },
    { wch: 20 }, { wch: 10 }, { wch: 14 }, { wch: 16 }, { wch: 12 },
    { wch: 35 }, { wch: 18 }, { wch: 16 }, { wch: 14 },
  ];
  ws["!autofilter"] = { ref: "A1:N1" };
  XLSX.utils.book_append_sheet(wb, ws, "Leads");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="CRS-Leads-${new Date().toISOString().split("T")[0]}.xlsx"`,
    },
  });
}


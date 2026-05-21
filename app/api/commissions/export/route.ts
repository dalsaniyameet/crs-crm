import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

export async function GET() {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const commissions = await prisma.commission.findMany({
    include: {
      deal:   { select: { title: true, value: true } },
      broker: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const rows = commissions.map((c, i) => ({
    "Sr.":          i + 1,
    "Deal":         c.deal?.title ?? "",
    "Deal Value":   c.deal?.value ?? 0,
    "Broker":       c.broker?.name ?? "",
    "Commission":   c.amount,
    "Rate (%)":     c.rate ?? "",
    "Status":       c.isPaid ? "Paid" : "Pending",
    "Paid On":      c.paidAt ? new Date(c.paidAt).toLocaleDateString("en-IN") : "",
    "Notes":        c.notes ?? "",
    "Created On":   new Date(c.createdAt).toLocaleDateString("en-IN"),
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [
    { wch: 5 }, { wch: 35 }, { wch: 14 }, { wch: 20 },
    { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 25 }, { wch: 14 },
  ];
  ws["!autofilter"] = { ref: "A1:J1" };
  XLSX.utils.book_append_sheet(wb, ws, "Commissions");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="CRS-Commissions-${new Date().toISOString().split("T")[0]}.xlsx"`,
    },
  });
}

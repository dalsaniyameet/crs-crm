import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

export async function GET() {
  try {
    const properties = await prisma.property.findMany({
      include: { listedBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });

    const rows = properties.map((p, i) => ({
      "Sr.":            i + 1,
      "Property Title": p.title,
      "Category":       p.category,
      "Type":           p.type,
      "Transaction":    p.transactionType,
      "Status":         p.status,
      "Price (₹)":      p.price,
      "Area (sqft)":    p.area,
      "Carpet Area":    p.carpetArea ?? "",
      "Floor":          p.floor ?? "",
      "Locality":       p.locality,
      "City":           p.city,
      "Address":        p.address ?? "",
      "Owner Name":     p.ownerName ?? "",
      "Owner Phone":    p.ownerPhone ?? "",
      "Owner Email":    p.ownerEmail ?? "",
      "Commission %":   p.commissionRate ?? "",
      "Amenities":      p.amenities.join(", "),
      "Verified":       p.isVerified ? "Yes" : "No",
      "Featured":       p.isFeatured ? "Yes" : "No",
      "Listed By":      p.listedBy?.name ?? "",
      "Added On":       new Date(p.createdAt).toLocaleDateString("en-IN"),
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);

    ws["!cols"] = [
      { wch: 5 }, { wch: 35 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
      { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 6 },
      { wch: 18 }, { wch: 12 }, { wch: 30 }, { wch: 20 }, { wch: 14 },
      { wch: 25 }, { wch: 12 }, { wch: 30 }, { wch: 8 }, { wch: 8 },
      { wch: 15 }, { wch: 12 },
    ];
    ws["!autofilter"] = { ref: "A1:V1" };

    XLSX.utils.book_append_sheet(wb, ws, "Properties");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="CRS-Properties-${new Date().toISOString().split("T")[0]}.xlsx"`,
      },
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

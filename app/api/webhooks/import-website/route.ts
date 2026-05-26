import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const WEBSITE_API = "https://cityrealspace.com/api/properties";

const TYPE_MAP: Record<string, string> = {
  apartment: "APARTMENT", flat: "APARTMENT",
  villa: "VILLA", bungalow: "VILLA", rowhouse: "VILLA",
  plot: "PLOT",
  office: "OFFICE",
  shop: "SHOP",
  showroom: "SHOWROOM",
  warehouse: "WAREHOUSE",
  factory: "INDUSTRIAL", industrial_land: "COMMERCIAL_LAND",
  coworking: "OFFICE",
};

const TRANSACTION_MAP: Record<string, string> = {
  "for-sale": "SELL", "new-launch": "SELL",
  "for-rent": "RENT", "rented": "RENT", "sold": "SELL",
};

const STATUS_MAP: Record<string, string> = {
  "for-sale": "AVAILABLE", "for-rent": "AVAILABLE", "new-launch": "AVAILABLE",
  "sold": "SOLD", "rented": "RENTED",
};

// CRS Brokerage Logic:
// RENT/LEASE → commissionRate = 1 month brokerage (stored as % but we use commissionNotes)
// SELL       → commissionRate = 1% of property value
function calcBrokerage(txn: string, price: number) {
  if (txn === "SELL") {
    return {
      commissionRate: 1,
      commissionNotes: `Sell: 1% = ₹${Math.round(price * 0.01).toLocaleString("en-IN")}`,
    };
  }
  // RENT or LEASE
  return {
    commissionRate: null, // not % based
    commissionNotes: `Rent: 1 month brokerage (₹${price.toLocaleString("en-IN")}) + 2 months security (₹${(price*2).toLocaleString("en-IN")}) + 1 month advance (₹${price.toLocaleString("en-IN")})`,
  };
}

function mapProperty(p: any) {
  const typeRaw   = (p.type     || "apartment").toLowerCase();
  const statusRaw = (p.status   || "for-sale").toLowerCase();
  const catRaw    = (p.category || "residential").toLowerCase();
  const furnished = (p.extraDetails?.furnished || "").toLowerCase();

  const txn   = (TRANSACTION_MAP[statusRaw] || "SELL");
  const price  = parseFloat(p.price || "0") || 0;
  const brok   = calcBrokerage(txn, price);

  return {
    title:           p.title || "Untitled",
    description:     p.description || null,
    type:            (TYPE_MAP[typeRaw]   || "APARTMENT") as any,
    category:        (catRaw === "commercial" ? "COMMERCIAL" : "RESIDENTIAL") as any,
    transactionType: txn as any,
    status:          (STATUS_MAP[statusRaw] || "AVAILABLE") as any,
    price,
    commissionRate:  brok.commissionRate,
    commissionNotes: brok.commissionNotes,
    area:            parseFloat(p.specs?.sqft || p.extraDetails?.superBuiltUp || "0") || 0,
    carpetArea:      parseFloat(p.extraDetails?.carpetArea  || "0") || null,
    superBuiltUp:    parseFloat(p.extraDetails?.superBuiltUp || "0") || null,
    floor:           parseInt(p.extraDetails?.oYourFloor || p.extraDetails?.floor || "0") || null,
    totalFloors:     parseInt(p.extraDetails?.oTotalFloors || p.extraDetails?.totalFloors || "0") || null,
    locality:        p.location?.area || "",
    city:            p.location?.city || "Ahmedabad",
    address:         `website:${p._id}`,
    photos:          Array.isArray(p.images)    ? p.images    : [],
    amenities:       Array.isArray(p.amenities) ? p.amenities : [],
    ownerName:       p.agent?.name  || null,
    ownerPhone:      p.agent?.phone || null,
    isFeatured:      p.isFeatured   || false,
    isVerified:      false,
    // residential details embedded for create
    _furnished: furnished,
    _bhk:       parseInt(p.specs?.beds  || p.extraDetails?.beds  || "0") || null,
    _baths:     parseInt(p.specs?.baths || p.extraDetails?.baths || "0") || null,
    _balconies: parseInt(p.extraDetails?.balconies || "0") || null,
    _society:   p.extraDetails?.project || null,
    _parking:   parseInt(p.extraDetails?.coveredParking || "0") || null,
    _lift:      (p.extraDetails?.lift || "").toLowerCase().includes("available"),
  };
}

export async function POST(req: NextRequest) {
  try {
    let imported = 0, updated = 0, errors = 0;
    const log: string[] = [];

    // Fetch all pages
    let page = 1, allProps: any[] = [];
    while (true) {
      const res  = await fetch(`${WEBSITE_API}?page=${page}&limit=50`, { cache: "no-store" });
      const data = await res.json();
      const props = data.properties || [];
      if (!props.length) break;
      allProps = [...allProps, ...props];
      if (page >= (data.pages || 1)) break;
      page++;
    }

    for (const p of allProps) {
      try {
        const mapped = mapProperty(p);
        const { _furnished, _bhk, _baths, _balconies, _society, _parking, _lift, ...propertyData } = mapped;

        const existing = await prisma.property.findFirst({
          where: { address: `website:${p._id}` },
        });

        if (existing) {
          await prisma.property.update({
            where: { id: existing.id },
            data: { price: propertyData.price, status: propertyData.status, photos: propertyData.photos, description: propertyData.description },
          });
          updated++;
          log.push(`✅ Updated: ${p.title}`);
        } else {
          const created = await prisma.property.create({ data: propertyData });

          if (propertyData.category === "RESIDENTIAL") {
            await prisma.residentialDetail.create({
              data: {
                propertyId: created.id,
                bhk:        _bhk,
                bathrooms:  _baths,
                balconies:  _balconies,
                furnishing: (_furnished.includes("fully") ? "FULLY_FURNISHED" : _furnished.includes("semi") ? "SEMI_FURNISHED" : "UNFURNISHED") as any,
                society:    _society,
              },
            }).catch(() => {});
          } else {
            await prisma.commercialDetail.create({
              data: { propertyId: created.id, parkingSlots: _parking, liftAvailable: _lift },
            }).catch(() => {});
          }

          imported++;
          log.push(`🆕 Imported: ${p.title}`);
        }
      } catch (err: any) {
        errors++;
        log.push(`❌ Error: ${p.title} — ${err.message}`);
      }
    }

    return NextResponse.json({ success: true, total: allProps.length, imported, updated, errors, log });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const res  = await fetch(`${WEBSITE_API}?page=1&limit=1`, { cache: "no-store" });
    const data = await res.json();
    return NextResponse.json({ total: data.total || 0, pages: data.pages || 0 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

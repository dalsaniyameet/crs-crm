import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Secret token to verify requests are from cityrealspace.com
const WEBHOOK_SECRET = process.env.WEBSITE_WEBHOOK_SECRET || "crs-website-secret-2024";

// Map website property types to CRM enum
const TYPE_MAP: Record<string, string> = {
  apartment: "APARTMENT", flat: "APARTMENT",
  villa: "VILLA",
  bungalow: "VILLA",
  rowhouse: "VILLA",
  plot: "PLOT",
  office: "OFFICE",
  shop: "SHOP",
  showroom: "SHOWROOM",
  warehouse: "WAREHOUSE",
  factory: "INDUSTRIAL",
  coworking: "OFFICE",
  industrial_land: "COMMERCIAL_LAND",
};

const CATEGORY_MAP: Record<string, string> = {
  residential: "RESIDENTIAL",
  commercial: "COMMERCIAL",
};

const STATUS_MAP: Record<string, string> = {
  "for-sale": "AVAILABLE",
  "for-rent": "AVAILABLE",
  "new-launch": "AVAILABLE",
  sold: "SOLD",
  rented: "RENTED",
};

const TRANSACTION_MAP: Record<string, string> = {
  "for-sale": "SELL",
  "for-rent": "RENT",
  "new-launch": "SELL",
};

// CRS Brokerage Logic
function calcBrokerage(txn: string, price: number) {
  if (txn === "SELL") {
    return {
      commissionRate: 1,
      commissionNotes: `Sell: 1% = ₹${Math.round(price * 0.01).toLocaleString("en-IN")}`,
    };
  }
  return {
    commissionRate: null,
    commissionNotes: `Rent: 1 month brokerage (₹${price.toLocaleString("en-IN")}) + 2 months security (₹${(price*2).toLocaleString("en-IN")}) + 1 month advance (₹${price.toLocaleString("en-IN")})`,
  };
}

export async function POST(req: NextRequest) {
  try {
    // Verify secret
    const secret = req.headers.get("x-webhook-secret") || req.headers.get("authorization")?.replace("Bearer ", "");
    if (secret !== WEBHOOK_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    // Extract fields from website property object
    const title       = (body.title || "").trim();
    const typeRaw     = (body.type || "apartment").toLowerCase();
    const categoryRaw = (body.category || "residential").toLowerCase();
    const statusRaw   = (body.status || "for-sale").toLowerCase();
    const price       = parseFloat(body.price || body.actualPrice || "0") || 0;
    const locality    = body.location?.area || body.area || body.locality || "";
    const city        = body.location?.city || body.city || "Ahmedabad";
    const description = body.description || body.desc || null;
    const photos      = Array.isArray(body.images) ? body.images : [];
    const amenities   = Array.isArray(body.amenities) ? body.amenities : [];
    const ownerName   = body.agent?.name  || body.agentName  || null;
    const ownerPhone  = body.agent?.phone || body.agentPhone || null;
    const websiteId   = String(body._id || body.websiteId || "") || null;
    const isFeatured  = body.isFeatured || body.featured || false;

    const txnType = TRANSACTION_MAP[statusRaw] as any || "SELL";
    const brok     = calcBrokerage(txnType, price);

    if (!title || !locality) {
      return NextResponse.json({ error: "title and locality required" }, { status: 400 });
    }

    // Check duplicate by websiteId or title+locality
    const existing = await prisma.property.findFirst({
      where: {
        OR: [
          ...(websiteId ? [{ address: `website:${websiteId}` }] : []),
          { title, locality },
        ],
      },
    });

    if (existing) {
      await prisma.property.update({
        where: { id: existing.id },
        data: {
          price,
          photos,
          description,
          commissionNotes: brok.commissionNotes,
          commissionRate:  brok.commissionRate,
          status: STATUS_MAP[statusRaw] as any || "AVAILABLE",
          updatedAt: new Date(),
        },
      });

      await prisma.activity.create({
        data: {
          type: "PROPERTY_UPDATED",
          description: `Property updated from website: ${title} — ${locality}, ${city}`,
          metadata: { websiteId, source: "website_webhook" },
        },
      });

      return NextResponse.json({ status: "updated", propertyId: existing.id });
    }

    // Create new property
    const property = await prisma.property.create({
      data: {
        title,
        description,
        type:            TYPE_MAP[typeRaw] as any || "APARTMENT",
        category:        CATEGORY_MAP[categoryRaw] as any || "RESIDENTIAL",
        transactionType: txnType,
        status:          STATUS_MAP[statusRaw] as any || "AVAILABLE",
        price,
        commissionRate:  brok.commissionRate,
        commissionNotes: brok.commissionNotes,
        area:            parseFloat(body.extraDetails?.superBuiltUp || body.specs?.sqft || "0") || 0,
        carpetArea:      parseFloat(body.extraDetails?.carpetArea || "0") || null,
        superBuiltUp:    parseFloat(body.extraDetails?.superBuiltUp || "0") || null,
        floor:           parseInt(body.extraDetails?.floor || "0") || null,
        totalFloors:     parseInt(body.extraDetails?.totalFloors || "0") || null,
        facing:          body.extraDetails?.facing || null,
        locality,
        city,
        address:         `website:${websiteId}`, // store website ID for dedup
        amenities,
        photos,
        ownerName,
        ownerPhone,
        isFeatured:      body.isFeatured || false,
        isVerified:      false, // needs manual verification
      },
    });

    // Create residential/commercial details
    if (CATEGORY_MAP[categoryRaw] === "RESIDENTIAL") {
      await prisma.residentialDetail.create({
        data: {
          propertyId: property.id,
          bhk:        parseInt(body.specs?.beds || body.extraDetails?.beds || "0") || null,
          bathrooms:  parseInt(body.specs?.baths || body.extraDetails?.baths || "0") || null,
          balconies:  parseInt(body.extraDetails?.balconies || "0") || null,
          furnishing: (body.extraDetails?.furnished === "Fully Furnished" ? "FULLY_FURNISHED"
                     : body.extraDetails?.furnished === "Semi Furnished" ? "SEMI_FURNISHED"
                     : "UNFURNISHED") as any,
          society:    body.extraDetails?.project || null,
        },
      });
    } else {
      await prisma.commercialDetail.create({
        data: {
          propertyId:    property.id,
          parkingSlots:  parseInt(body.extraDetails?.coveredParking || "0") || null,
          liftAvailable: body.extraDetails?.lift !== "Not Available",
        },
      });
    }

    await prisma.activity.create({
      data: {
        type:        "PROPERTY_CREATED",
        description: `New property from website: ${title} — ${locality}, ${city}`,
        metadata:    { websiteId, source: "website_webhook", price, type: typeRaw },
      },
    });

    return NextResponse.json({ status: "created", propertyId: property.id }, { status: 201 });
  } catch (err) {
    console.error("Property webhook error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: "active",
    endpoint: "/api/webhooks/property",
    description: "Receives property data from cityrealspace.com website",
  });
}

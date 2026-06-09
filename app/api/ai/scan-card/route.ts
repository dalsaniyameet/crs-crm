import { NextRequest, NextResponse } from "next/server";
import { uploadCardImage } from "@/lib/cloudinary";
import { prisma } from "@/lib/prisma";
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const COMPANY_WA_URL = "https://wa.me/919825031247";

const introMessage = (name: string, propertyTitle?: string) => {
  const propLine = propertyTitle ? `\n\n🏢 Regarding your property: *${propertyTitle}*` : "";
  return `Hello ${name}! 👋${propLine}\n\nI'm from *City Real Space*, Ahmedabad's trusted real estate brokerage.\n\n✅ Free listing\n✅ Verified clients only\n✅ Best market price guaranteed\n\nWe'd love to help you find the right buyer/tenant quickly!\n\n📞 Connect: ${COMPANY_WA_URL}\n📍 A-708, Prahlad Nagar Trade Centre, Satellite, Ahmedabad`;
};

export async function POST(req: NextRequest) {
  try {
    const formData  = await req.formData();
    const file      = formData.get("file") as File;
    const saveOwner = formData.get("saveOwner");
    const autoSave  = saveOwner !== "false";

    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

    const buffer   = Buffer.from(await file.arrayBuffer());
    let mimeType   = file.type || "image/jpeg";
    let imageBuffer = buffer;

    // PDF → convert first page to image using sharp if available, else send as-is
    if (mimeType === "application/pdf" || file.name?.toLowerCase().endsWith(".pdf")) {
      // For PDF, we'll use the buffer directly with a jpeg mime for Groq
      // (Groq vision accepts base64 images; PDF not supported — extract first page)
    // PDF not supported by Groq vision — skip pdf-parse, treat buffer as-is
      if (true) {
        mimeType = "image/jpeg";
      }
    }

    // Normalize mime type for Groq (only jpeg/png/webp/gif supported)
    const supportedMimes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!supportedMimes.includes(mimeType)) mimeType = "image/jpeg";

    const base64Image = imageBuffer.toString("base64");
    const dataUrl     = `data:${mimeType};base64,${base64Image}`;

      const imageUrlPromise = uploadCardImage(buffer).catch((e) => { console.error("Cloudinary upload failed:", e.message); return ""; });

    const res = await groq.chat.completions.create({
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `You are a data extractor. Output ONLY raw valid JSON, no explanation, no markdown, no code blocks.

Extract from this real estate property sticker or visiting card:
{"ownerName":"","ownerPhone":"","ownerPhone2":"","ownerEmail":"","companyName":"","propertyTitle":"","locality":"","address":"","propertyType":"","transactionType":"","price":"","area":"","floor":"","furnishing":"","condition":"","brokerage":"","status":"","amenities":"","description":"","notes":""}

Rules:
- ownerPhone: 10 digits only, no +91, no spaces
- price: number only ("25.00 Thd"=25000, "1.5L"=150000, "2Cr"=20000000)
- area: number only in sqft
- propertyType: OFFICE/SHOP/SHOWROOM/WAREHOUSE/APARTMENT/VILLA/PLOT/PENTHOUSE/STUDIO
- transactionType: RENT/LEASE/SELL`,
            },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
      max_tokens: 500,
      temperature: 0,
    });

    const content = res.choices[0]?.message?.content || "{}";
    console.log("Groq raw response:", content.slice(0, 300));
    let extracted: Record<string, string> = {};
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) extracted = JSON.parse(jsonMatch[0]);
    } catch (parseErr) {
      console.error("JSON parse failed, raw:", content.slice(0, 500));
      // Try to extract key fields manually from plain text
      const phoneMatch = content.match(/(?:\+91[\s-]?)?([6-9]\d{9})/);
      const nameMatch  = content.match(/(?:name|owner)[:\s]+([A-Z][a-z]+ ?[A-Z]?[a-z]*)/i);
      extracted = {
        ownerPhone: phoneMatch?.[1] || "",
        ownerName:  nameMatch?.[1]  || "",
      };
    }

    const imageUrl = await imageUrlPromise;

    // Normalize price
    let priceNum = 0;
    if (extracted.price) {
      const raw = String(extracted.price).replace(/,/g, "");
      priceNum = parseFloat(raw) || 0;
      // Handle "Thd" = thousands
      if (extracted.priceUnit === "monthly" && priceNum < 1000) priceNum = priceNum * 1000;
    }

    // Auto-save owner
    let owner = null;
    if (autoSave && extracted.ownerPhone) {
      const cleanPhone = String(extracted.ownerPhone).replace(/\D/g, "").replace(/^91/, "").slice(-10);
      owner = await prisma.propertyOwner.create({
        data: {
          name:         String(extracted.ownerName   || "Unknown"),
          phone:        cleanPhone,
          phone2:       extracted.ownerPhone2 ? String(extracted.ownerPhone2).replace(/\D/g, "").replace(/^91/, "").slice(-10) : null,
          email:        extracted.ownerEmail  ? String(extracted.ownerEmail)  : null,
          company:      extracted.companyName ? String(extracted.companyName) : null,
          address:      extracted.address     ? String(extracted.address)     : null,
          locality:     extracted.locality    ? String(extracted.locality)    : null,
          cardImageUrl: imageUrl,
          notes: JSON.stringify({
            propertyTitle:   extracted.propertyTitle   || null,
            propertyType:    extracted.propertyType    || null,
            transactionType: extracted.transactionType || null,
            price:           priceNum                  || null,
            area:            parseFloat(extracted.area) || null,
            floor:           extracted.floor           || null,
            totalFloors:     extracted.totalFloors     || null,
            furnishing:      extracted.furnishing      || null,
            condition:       extracted.condition       || null,
            brokerage:       extracted.brokerage       || null,
            status:          extracted.status          || null,
            amenities:       extracted.amenities       || null,
            description:     extracted.description     || null,
            rawNotes:        extracted.notes           || null,
          }),
        },
      });

      const msg = introMessage(extracted.ownerName || "there", extracted.propertyTitle);
      await prisma.ownerMessage.create({
        data: { ownerId: owner.id, direction: "OUT", message: msg },
      });
    }

    const cleanPhone = extracted.ownerPhone
      ? String(extracted.ownerPhone).replace(/\D/g, "").replace(/^91/, "").slice(-10)
      : "";

    return NextResponse.json({
      // Owner fields
      ownerName:    extracted.ownerName    || "",
      ownerPhone:   cleanPhone,
      ownerPhone2:  extracted.ownerPhone2  ? String(extracted.ownerPhone2).replace(/\D/g, "").slice(-10) : "",
      ownerEmail:   extracted.ownerEmail   || "",
      companyName:  extracted.companyName  || "",
      address:      extracted.address      || "",
      locality:     extracted.locality     || "",
      notes:        extracted.notes        || "",
      // Property fields
      propertyTitle:  extracted.propertyTitle  || "",
      propertyType:   extracted.propertyType   || "",
      transactionType: extracted.transactionType || "",
      price:          priceNum,
      priceUnit:      extracted.priceUnit      || "",
      area:           parseFloat(extracted.area) || 0,
      areaUnit:       extracted.areaUnit        || "sqft",
      floor:          extracted.floor           || "",
      totalFloors:    extracted.totalFloors     || "",
      furnishing:     extracted.furnishing      || "",
      condition:      extracted.condition       || "",
      brokerage:      extracted.brokerage       || "",
      status:         extracted.status          || "",
      amenities:      extracted.amenities       || "",
      description:    extracted.description     || "",
      // Meta
      imageUrl,
      owner,
      waUrl: cleanPhone
        ? `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(introMessage(extracted.ownerName || "there", extracted.propertyTitle))}`
        : null,
    });
  } catch (err: unknown) {
    const msg = (err as Error).message;
    console.error("Scan card error:", msg);
    return NextResponse.json({ error: msg || "Failed to scan card" }, { status: 500 });
  }
}

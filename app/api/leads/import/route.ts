import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

function normalizePhone(p: string) {
  return String(p || "").replace(/\D/g, "").slice(-10);
}

function normalizeName(n: string) {
  return String(n || "").toLowerCase().trim();
}

// Fuzzy name match — returns true if names share 2+ words or one fully contains the other
function nameMatch(a: string, b: string) {
  const wa = normalizeName(a).split(/\s+/);
  const wb = normalizeName(b).split(/\s+/);
  const common = wa.filter(w => w.length > 2 && wb.includes(w));
  return common.length >= 1 || normalizeName(a).includes(normalizeName(b)) || normalizeName(b).includes(normalizeName(a));
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

    // Parse Excel
    const buffer = Buffer.from(await file.arrayBuffer());
    const wb     = XLSX.read(buffer, { type: "buffer" });
    const ws     = wb.Sheets[wb.SheetNames[0]];
    const rows   = XLSX.utils.sheet_to_json(ws, { defval: "" }) as Record<string, any>[];

    if (rows.length === 0) return NextResponse.json({ error: "Excel file is empty" }, { status: 400 });

    // Load existing leads + owners for matching
    const [existingLeads, allOwners] = await Promise.all([
      prisma.lead.findMany({ select: { phone: true, id: true, name: true } }),
      prisma.propertyOwner.findMany({ select: { id: true, name: true, phone: true, phone2: true, locality: true } }),
    ]);

    const existingPhones = new Set(existingLeads.map(l => normalizePhone(l.phone)));

    // Column name aliases — handles any Excel header variation
    function getVal(row: Record<string, any>, ...keys: string[]) {
      for (const k of keys) {
        const found = Object.keys(row).find(rk => rk.toLowerCase().replace(/[\s_-]/g, "").includes(k.toLowerCase().replace(/[\s_-]/g, "")));
        if (found && row[found] !== "" && row[found] !== undefined) return String(row[found]).trim();
      }
      return "";
    }

    const results = {
      imported:    0,
      duplicates:  0,
      ownerMatch:  0,
      errors:      0,
      leads:       [] as any[],
      matchedOwners: [] as any[],
    };

    for (const row of rows) {
      try {
        const name  = getVal(row, "name", "clientname", "customer", "contact");
        const phone = normalizePhone(getVal(row, "phone", "mobile", "contact", "number", "cell"));
        if (!phone || phone.length < 10) { results.errors++; continue; }

        // Duplicate check
        if (existingPhones.has(phone)) { results.duplicates++; continue; }
        existingPhones.add(phone);

        const budget    = parseFloat(getVal(row, "budget", "amount", "price", "value").replace(/[^0-9.]/g, "")) || undefined;
        const email     = getVal(row, "email", "mail");
        const source    = getVal(row, "source", "leadsource", "from") || "OTHER";
        const propType  = getVal(row, "propertytype", "type", "property");
        const txnType   = getVal(row, "transactiontype", "transaction", "buysell", "rentbuy");
        const area      = getVal(row, "area", "locality", "location", "zone", "place");
        const notes     = getVal(row, "notes", "remarks", "comment", "description", "requirement");
        const altPhone  = normalizePhone(getVal(row, "alternatephone", "altphone", "phone2", "mobile2"));

        // Map source
        const SOURCE_MAP: Record<string, string> = {
          website: "WEBSITE", whatsapp: "WHATSAPP", facebook: "FACEBOOK",
          google: "GOOGLE_BUSINESS", "99acres": "ACRES99", magicbricks: "MAGICBRICKS",
          housing: "HOUSING", referral: "REFERRAL", walkin: "WALK_IN",
          coldcall: "COLD_CALL", excel: "OTHER", import: "OTHER",
        };
        const mappedSource = SOURCE_MAP[source.toLowerCase().replace(/\s/g, "")] || "OTHER";

        // Map property type
        const PTYPE_MAP: Record<string, string> = {
          office: "OFFICE", shop: "SHOP", showroom: "SHOWROOM", warehouse: "WAREHOUSE",
          apartment: "APARTMENT", flat: "APARTMENT", villa: "VILLA", plot: "PLOT",
          penthouse: "PENTHOUSE", studio: "STUDIO", land: "COMMERCIAL_LAND", industrial: "INDUSTRIAL",
        };
        const mappedPType = PTYPE_MAP[propType.toLowerCase()] || undefined;

        // Map transaction type
        const TXN_MAP: Record<string, string> = {
          buy: "BUY", purchase: "BUY", sell: "SELL", rent: "RENT", lease: "LEASE",
        };
        const mappedTxn = TXN_MAP[txnType.toLowerCase()] || undefined;

        // Create lead
        const lead = await prisma.lead.create({
          data: {
            name:            name || "Unknown",
            phone:           phone,
            alternatePhone:  altPhone || null,
            email:           email || null,
            source:          mappedSource as any,
            status:          "NEW",
            score:           50,
            budget:          budget || null,
            propertyType:    mappedPType as any || null,
            transactionType: mappedTxn as any || null,
            preferredAreas:  area ? [area] : [],
            notes:           notes || null,
            assignedToId:    user.role === "BROKER" ? user.id : null,
          },
        });

        results.imported++;
        results.leads.push({ id: lead.id, name: lead.name, phone: lead.phone });

        // ── Owner match by phone or name ──
        const matchedOwner = allOwners.find(o => {
          const op1 = normalizePhone(o.phone);
          const op2 = normalizePhone(o.phone2 || "");
          return op1 === phone || op2 === phone || (name && nameMatch(o.name, name));
        });

        if (matchedOwner) {
          results.ownerMatch++;
          results.matchedOwners.push({
            leadId:    lead.id,
            leadName:  lead.name,
            leadPhone: lead.phone,
            ownerId:   matchedOwner.id,
            ownerName: matchedOwner.name,
            ownerPhone: matchedOwner.phone,
            matchType: normalizePhone(matchedOwner.phone) === phone ? "phone" : "name",
          });

          // Log activity for matched lead
          await prisma.activity.create({
            data: {
              type:        "OWNER_MATCH",
              description: `⚠️ Lead "${lead.name}" matches Property Owner "${matchedOwner.name}" — possible same person`,
              leadId:      lead.id,
              userId:      user.id,
            },
          });

          // Notify admin
          const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
          await Promise.all(admins.map(a =>
            prisma.notification.create({
              data: {
                type:    "SYSTEM",
                title:   "🔗 Lead–Owner Match Detected",
                message: `"${lead.name}" (${lead.phone}) matches owner "${matchedOwner.name}" — review needed`,
                userId:  a.id,
                leadId:  lead.id,
              },
            })
          ));
        }

        // Create follow-up task (next 24h)
        await prisma.task.create({
          data: {
            title:       `Follow up with ${lead.name}`,
            description: `Imported from Excel. Call ${lead.phone}${notes ? ` — ${notes.slice(0, 80)}` : ""}`,
            dueAt:       new Date(Date.now() + 24 * 60 * 60 * 1000),
            priority:    "HIGH",
            leadId:      lead.id,
            assignedToId: user.role === "BROKER" ? user.id : null,
          },
        });

      } catch { results.errors++; }
    }

    return NextResponse.json(results, { status: 201 });
  } catch (err: any) {
    console.error("Import error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}


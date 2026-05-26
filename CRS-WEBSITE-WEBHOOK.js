/**
 * ============================================================
 * CRS WEBSITE → CRM SYNC
 * Ye file apni WEBSITE ke codebase mein paste karo
 * Jab bhi property save/update ho, CRM automatically update hoga
 * ============================================================
 *
 * SETUP:
 * 1. Is file ko website ke root mein rakho: crs-webhook.js
 * 2. Property save karne wali file mein import karo:
 *    const { syncPropertyToCRM } = require('./crs-webhook');
 * 3. Property save hone ke baad call karo:
 *    await syncPropertyToCRM(propertyData);
 * ============================================================
 */

const https = require("https");
const http  = require("http");

// ── CONFIG ──────────────────────────────────────────────────
const CRM_URL    = "https://crs-crm.vercel.app/api/webhooks/property";
const CRM_SECRET = "crs-website-secret-2024"; // .env mein WEBSITE_WEBHOOK_SECRET se match karna chahiye
// ────────────────────────────────────────────────────────────

/**
 * Website property object ko CRM format mein convert karta hai
 * Apni website ke field names yahan match karo
 */
function mapPropertyToCRM(property) {
  // ── Transaction type detect karna ──
  // Apni website ke status/type field ke hisab se adjust karo
  let status = "for-sale";
  const rawStatus = (property.status || property.listingType || "").toLowerCase();
  const rawType   = (property.type   || property.propertyFor || "").toLowerCase();

  if (rawStatus.includes("rent") || rawType.includes("rent"))   status = "for-rent";
  else if (rawStatus.includes("lease") || rawType.includes("lease")) status = "for-rent";
  else if (rawStatus.includes("sold"))  status = "sold";
  else if (rawStatus.includes("rent"))  status = "for-rent";
  else                                  status = "for-sale";

  // ── Category detect karna ──
  const commercialTypes = ["office", "shop", "showroom", "warehouse", "factory", "industrial", "commercial"];
  const typeStr = (property.propertyType || property.category || property.type || "").toLowerCase();
  const category = commercialTypes.some(t => typeStr.includes(t)) ? "commercial" : "residential";

  return {
    // ── Basic Info ──
    title:       property.title       || property.name        || "Untitled Property",
    description: property.description || property.desc        || null,
    type:        property.propertyType|| property.type        || "apartment",
    category:    category,
    status:      status,

    // ── Price ──
    price: parseFloat(
      property.price       ||
      property.actualPrice ||
      property.askingPrice ||
      property.rent        || "0"
    ) || 0,

    // ── Location ──
    locality: property.locality  || property.area     || property.location?.area  || "",
    city:     property.city      || property.location?.city || "Ahmedabad",
    address:  property.address   || property.fullAddress || null,

    // ── Size ──
    area:         parseFloat(property.area    || property.sqft        || property.builtUpArea || "0") || 0,
    carpetArea:   parseFloat(property.carpetArea  || "0") || null,
    superBuiltUp: parseFloat(property.superBuiltUp || property.superArea || "0") || null,

    // ── Details ──
    floor:       parseInt(property.floor      || "0") || null,
    totalFloors: parseInt(property.totalFloors|| property.floors || "0") || null,
    facing:      property.facing || null,

    // ── Media ──
    images:    Array.isArray(property.images)    ? property.images    :
               Array.isArray(property.photos)    ? property.photos    :
               property.image ? [property.image] : [],
    amenities: Array.isArray(property.amenities) ? property.amenities :
               Array.isArray(property.features)  ? property.features  : [],

    // ── Owner/Agent ──
    agentName:  property.agentName  || property.ownerName  || property.postedBy?.name  || null,
    agentPhone: property.agentPhone || property.ownerPhone || property.postedBy?.phone || null,

    // ── Extra Details (residential) ──
    specs: {
      beds:  property.bedrooms  || property.bhk   || property.beds  || null,
      baths: property.bathrooms || property.baths || null,
    },
    extraDetails: {
      superBuiltUp:    property.superBuiltUp    || null,
      carpetArea:      property.carpetArea      || null,
      floor:           property.floor           || null,
      totalFloors:     property.totalFloors     || null,
      facing:          property.facing          || null,
      furnished:       property.furnished       || property.furnishing || null,
      project:         property.project         || property.society    || null,
      coveredParking:  property.parking         || property.coveredParking || null,
      lift:            property.lift            || null,
      balconies:       property.balconies       || null,
    },

    // ── Website ID (duplicate check ke liye) ──
    websiteId: String(property._id || property.id || property.propertyId || ""),
    isFeatured: property.isFeatured || property.featured || false,
  };
}

/**
 * CRM ko property data bhejta hai
 * @param {Object} property - Website ka property object
 * @returns {Promise<{success: boolean, status: string, propertyId?: string}>}
 */
async function syncPropertyToCRM(property) {
  try {
    const payload = JSON.stringify(mapPropertyToCRM(property));
    const url     = new URL(CRM_URL);
    const isHttps = url.protocol === "https:";
    const lib     = isHttps ? https : http;

    return new Promise((resolve) => {
      const options = {
        hostname: url.hostname,
        port:     url.port || (isHttps ? 443 : 80),
        path:     url.pathname,
        method:   "POST",
        headers: {
          "Content-Type":     "application/json",
          "Content-Length":   Buffer.byteLength(payload),
          "x-webhook-secret": CRM_SECRET,
        },
      };

      const req = lib.request(options, (res) => {
        let data = "";
        res.on("data", chunk => data += chunk);
        res.on("end", () => {
          try {
            const json = JSON.parse(data);
            console.log(`✅ CRM Sync: ${json.status} — propertyId: ${json.propertyId || "?"}`);
            resolve({ success: true, ...json });
          } catch {
            resolve({ success: false, status: "parse_error" });
          }
        });
      });

      req.on("error", (err) => {
        console.error("❌ CRM Sync failed:", err.message);
        resolve({ success: false, status: "network_error", error: err.message });
      });

      req.setTimeout(8000, () => {
        req.destroy();
        console.error("❌ CRM Sync timeout");
        resolve({ success: false, status: "timeout" });
      });

      req.write(payload);
      req.end();
    });
  } catch (err) {
    console.error("❌ CRM Sync error:", err.message);
    return { success: false, status: "error", error: err.message };
  }
}

module.exports = { syncPropertyToCRM, mapPropertyToCRM };

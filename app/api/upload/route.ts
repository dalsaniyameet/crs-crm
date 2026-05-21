import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import https from "https";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cloudinaryUpload(
  fileBuffer: Buffer,
  mimeType: string,
  folder: string,
  cloudName: string,
  apiKey: string,
  apiSecret: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const timestamp = Math.floor(Date.now() / 1000).toString();

    // resource_type based on mime
    let resourceType = "image";
    if (mimeType === "application/pdf" || mimeType.startsWith("application/") || mimeType.startsWith("text/")) {
      resourceType = "raw";
    } else if (mimeType.startsWith("video/")) {
      resourceType = "video";
    }

    // signature
    const sigStr = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
    const signature = crypto.createHash("sha1").update(sigStr).digest("hex");

    // build multipart body manually
    const boundary = "----CRSUpload" + Date.now();
    const CRLF = "\r\n";

    function part(name: string, value: string): Buffer {
      return Buffer.from(
        `--${boundary}${CRLF}Content-Disposition: form-data; name="${name}"${CRLF}${CRLF}${value}${CRLF}`
      );
    }

    const ext = mimeType.split("/")[1]?.split(";")[0] || "bin";
    const fileHeader = Buffer.from(
      `--${boundary}${CRLF}Content-Disposition: form-data; name="file"; filename="upload.${ext}"${CRLF}Content-Type: ${mimeType}${CRLF}${CRLF}`
    );
    const fileFooter = Buffer.from(`${CRLF}--${boundary}--${CRLF}`);

    const body = Buffer.concat([
      part("folder", folder),
      part("timestamp", timestamp),
      part("api_key", apiKey),
      part("signature", signature),
      fileHeader,
      fileBuffer,
      fileFooter,
    ]);

    const options = {
      hostname: "api.cloudinary.com",
      path: `/v1_1/${cloudName}/${resourceType}/upload`,
      method: "POST",
      headers: {
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        "Content-Length": body.length,
      },
    };

    const reqHttp = https.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        try {
          const json = JSON.parse(Buffer.concat(chunks).toString());
          if (json.secure_url) resolve(json.secure_url);
          else reject(new Error(json.error?.message || "No URL returned"));
        } catch {
          reject(new Error("Invalid JSON from Cloudinary"));
        }
      });
    });

    reqHttp.on("error", reject);
    reqHttp.write(body);
    reqHttp.end();
  });
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey    = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    if (!cloudName || !apiKey || !apiSecret)
      return NextResponse.json({ error: "Cloudinary not configured" }, { status: 500 });

    const formData = await req.formData();
    const files   = formData.getAll("file") as File[];
    const folder  = `cityreals/${(formData.get("folder") as string) || (formData.get("propertyId") as string) || "general"}`;

    if (!files.length) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    // Upload all files in parallel
    const urls = await Promise.all(
      files.map(async (file) => {
        const buffer = Buffer.from(await file.arrayBuffer());
        const mime   = file.type || "application/octet-stream";
        const url    = await cloudinaryUpload(buffer, mime, folder, cloudName, apiKey, apiSecret);
        return { url, name: file.name, type: file.type };
      })
    );

    // Return single url for backward compat, or urls array for multiple
    return NextResponse.json(urls.length === 1 ? { url: urls[0].url, urls } : { urls });

  } catch (err: unknown) {
    console.error("[upload]", err);
    return NextResponse.json({ error: (err as Error).message || "Upload failed" }, { status: 500 });
  }
}

import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function uploadPropertyImage(file: Buffer, propertyId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        { folder: `cityreals/properties/${propertyId}`, resource_type: "image", quality: "auto", fetch_format: "auto" },
        (err, result) => {
          if (err) reject(err);
          else resolve(result!.secure_url);
        }
      )
      .end(file);
  });
}

export async function uploadCardImage(file: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        { folder: "cityreals/cards", resource_type: "image", quality: "auto" },
        (err, result) => {
          if (err) reject(err);
          else resolve(result!.secure_url);
        }
      )
      .end(file);
  });
}

export async function uploadPropertyVideo(file: Buffer, propertyId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        { folder: `cityreals/properties/${propertyId}`, resource_type: "video" },
        (err, result) => {
          if (err) reject(err);
          else resolve(result!.secure_url);
        }
      )
      .end(file);
  });
}

export async function deleteCloudinaryAsset(publicId: string) {
  return cloudinary.uploader.destroy(publicId);
}

export default cloudinary;

import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://cityrealspacecrm.com";
  const now = new Date();
  return [
    // Only pages that actually exist AND are indexable
    { url: base,                 lastModified: now, changeFrequency: "daily",  priority: 1.0 },
    { url: `${base}/free-trial`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
  ];
}

import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://cityrealspacecrm.com";
  const now = new Date();
  return [
    { url: base,               lastModified: now, changeFrequency: "weekly",  priority: 1.0 },
    { url: `${base}/demo`,     lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/free-trial`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/sign-in`,  lastModified: now, changeFrequency: "yearly",  priority: 0.5 },
    { url: `${base}/sign-up`,  lastModified: now, changeFrequency: "yearly",  priority: 0.5 },
  ];
}

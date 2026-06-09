import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/demo", "/free-trial"],
        disallow: ["/dashboard", "/api/", "/sign-in", "/sign-up", "/admin-panel", "/_next/"],
      },
    ],
    sitemap: "https://cityrealspacecrm.com/sitemap.xml",
  };
}

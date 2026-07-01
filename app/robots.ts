import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/free-trial"],
        disallow: [
          "/dashboard",
          "/api/",
          "/sign-in",
          "/sign-up",
          "/admin-panel",
          "/_next/",
          "/demo",
          "/blog",
        ],
      },
    ],
    sitemap: "https://cityrealspacecrm.com/sitemap.xml",
  };
}

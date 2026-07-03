import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // The CRM is an internal, login-gated tool — nothing there should be indexed.
        disallow: ["/crm/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}

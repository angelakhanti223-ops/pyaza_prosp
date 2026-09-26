import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // The CRM is an internal, login-gated tool — nothing there should be indexed.
        // /kb/ is reserved for internal knowledge bases (currently served under /crm/kb/).
        disallow: ["/crm/", "/kb/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}

import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    // /trainer is crawlable on purpose: its pages carry noindex, which crawlers can only
    // see if they are allowed to fetch them.
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api", "/ingest"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}

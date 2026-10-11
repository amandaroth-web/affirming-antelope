import type { MetadataRoute } from "next";
import { AUDIENCE_SLUGS } from "@/lib/audiences";
import { getAllGuides } from "@/lib/guides";
import { SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const guides = getAllGuides();
  const newestGuide = guides[0]?.updated;
  const built = new Date();

  return [
    { url: SITE_URL, lastModified: built, changeFrequency: "weekly", priority: 1 },
    ...AUDIENCE_SLUGS.map((slug) => ({
      url: `${SITE_URL}/for/${slug}`,
      lastModified: built,
      changeFrequency: "monthly" as const,
      priority: 0.9,
    })),
    {
      url: `${SITE_URL}/guides`,
      lastModified: newestGuide ? new Date(newestGuide) : built,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    ...guides.map((g) => ({
      url: `${SITE_URL}/guides/${g.slug}`,
      lastModified: new Date(g.updated),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}

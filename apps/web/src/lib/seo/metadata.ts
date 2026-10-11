import type { Metadata } from "next";
import { SITE_NAME } from "@/lib/site";

type PageMeta = {
  /** Page title. Goes through the root template unless `absoluteTitle` is set. */
  title: string;
  absoluteTitle?: boolean;
  description: string;
  /** Path from the site root, e.g. `/for/leaders`. Becomes the canonical URL. */
  path: string;
  type?: "website" | "article";
  keywords?: string[];
  noindex?: boolean;
  modifiedTime?: string;
};

/**
 * Per-page metadata with canonical, Open Graph and Twitter fields filled in.
 * Child `openGraph` replaces the parent's wholesale, so every page sets all of it.
 * Images come from the nearest `opengraph-image.tsx`.
 */
export function pageMetadata({
  title,
  absoluteTitle = false,
  description,
  path,
  type = "website",
  keywords,
  noindex = false,
  modifiedTime,
}: PageMeta): Metadata {
  const socialTitle = absoluteTitle ? title : `${title} · ${SITE_NAME}`;
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    keywords,
    alternates: { canonical: path },
    robots: noindex ? { index: false, follow: true } : undefined,
    openGraph: {
      type,
      url: path,
      siteName: SITE_NAME,
      locale: "en_US",
      title: socialTitle,
      description,
      ...(type === "article" && modifiedTime ? { modifiedTime } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description,
    },
  };
}

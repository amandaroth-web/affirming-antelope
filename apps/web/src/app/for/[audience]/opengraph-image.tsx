import { AUDIENCE_SLUGS, getAudience } from "@/lib/audiences";
import { ogContentType, ogSize, renderOg } from "@/lib/og";

export const alt = "Affirming Antelope: Motivational Interviewing practice";
export const size = ogSize;
export const contentType = ogContentType;

export function generateStaticParams() {
  return AUDIENCE_SLUGS.map((audience) => ({ audience }));
}

export default async function Image({ params }: { params: Promise<{ audience: string }> }) {
  const { audience } = await params;
  const page = getAudience(audience);
  return renderOg({
    eyebrow: page ? `For ${page.name.toLowerCase()}` : "Motivational Interviewing practice",
    title: page?.h1 ?? "Practice better conversations.",
    pose: "celebrate",
    meta: "Free · In your browser",
  });
}

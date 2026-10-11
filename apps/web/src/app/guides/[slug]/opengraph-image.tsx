import { getAllGuides, getGuide } from "@/lib/guides";
import { ogContentType, ogSize, renderOg } from "@/lib/og";

export const alt = "A Motivational Interviewing guide from Affirming Antelope";
export const size = ogSize;
export const contentType = ogContentType;

export function generateStaticParams() {
  return getAllGuides({ includeDrafts: true }).map((g) => ({ slug: g.slug }));
}

const label = { clinicians: "MI for clinicians", leaders: "MI for leaders", trainers: "MI for trainers", all: "MI guide" };

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = getGuide(slug);
  return renderOg({
    eyebrow: guide ? label[guide.audience] : "MI guide",
    title: guide?.title ?? "Motivational interviewing guide",
    meta: guide ? `${guide.readingMinutes} min read` : undefined,
  });
}

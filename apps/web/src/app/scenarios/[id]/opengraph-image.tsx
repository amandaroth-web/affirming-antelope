import { ogContentType, ogSize, renderOg } from "@/lib/og";
import { difficultyLabel, getAllScenarios, getPublicScenario, seoFor } from "@/lib/scenarios";

export const alt = "A motivational interviewing role-play scenario from Affirming Antelope";
export const size = ogSize;
export const contentType = ogContentType;

export function generateStaticParams() {
  return getAllScenarios().map((s) => ({ id: s.id }));
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scenario = getPublicScenario(id);
  return renderOg({
    eyebrow: "Role-play scenario",
    title: scenario ? seoFor(scenario).h1 : "Motivational interviewing role-play",
    pose: "celebrate",
    meta: scenario ? difficultyLabel[scenario.difficulty] : undefined,
  });
}

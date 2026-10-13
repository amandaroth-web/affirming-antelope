import { ogContentType, ogSize, renderOg } from "@/lib/og";

export const alt = "Affirming Antelope: Motivational Interviewing practice for healthcare leaders. Five-minute drills and live role-plays.";
export const size = ogSize;
export const contentType = ogContentType;

export default function Image() {
  return renderOg({
    eyebrow: "Motivational interviewing practice",
    title: "Rehearse the hard conversation.",
    subtitle: "For healthcare managers and team leads. Free, in your browser.",
  });
}

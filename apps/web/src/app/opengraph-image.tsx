import { ogContentType, ogSize, renderOg } from "@/lib/og";

export const alt = "Affirming Antelope: Motivational Interviewing practice for healthcare leaders. Five-minute drills and live role-plays.";
export const size = ogSize;
export const contentType = ogContentType;

export default function Image() {
  return renderOg({
    eyebrow: "MI practice for healthcare leaders",
    title: "Rehearse the hard conversation.",
    subtitle: "For managers and team leads in healthcare. Free, in your browser.",
  });
}

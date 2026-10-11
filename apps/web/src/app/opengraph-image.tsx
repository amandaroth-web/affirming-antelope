import { ogContentType, ogSize, renderOg } from "@/lib/og";

export const alt = "Affirming Antelope: Motivational Interviewing practice. Five-minute drills and live role-plays.";
export const size = ogSize;
export const contentType = ogContentType;

export default function Image() {
  return renderOg({
    eyebrow: "Motivational Interviewing practice",
    title: "Practice better conversations.",
    subtitle: "Five-minute OARS drills and live role-plays. Free, in your browser.",
  });
}

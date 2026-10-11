import { ogContentType, ogSize, renderOg } from "@/lib/og";

export const alt = "Motivational interviewing guides from Affirming Antelope";
export const size = ogSize;
export const contentType = ogContentType;

export default function Image() {
  return renderOg({
    eyebrow: "MI guides",
    title: "Motivational interviewing, one skill at a time.",
    subtitle: "Examples you can hear, and a drill to try each one.",
  });
}

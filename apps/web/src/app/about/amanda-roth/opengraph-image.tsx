import { ogContentType, ogSize, renderOg } from "@/lib/og";

export const alt = "Amanda Roth, LCSW | Affirming Antelope";
export const size = ogSize;
export const contentType = ogContentType;

export default function Image() {
  return renderOg({
    eyebrow: "About",
    title: "Amanda Roth, LCSW",
    subtitle: "Principal, Psychotherapy Clinical Quality. Designed the MI for Leaders program.",
  });
}

import { ogContentType, ogSize, renderOg } from "@/lib/og";

export const alt = "About Affirming Antelope | Affirming Antelope";
export const size = ogSize;
export const contentType = ogContentType;

export default function Image() {
  return renderOg({
    eyebrow: "About",
    title: "About Affirming Antelope",
    subtitle: "Motivational interviewing practice, designed by Amanda Roth, LCSW.",
  });
}

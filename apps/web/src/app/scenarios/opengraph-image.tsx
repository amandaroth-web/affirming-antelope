import { ogContentType, ogSize, renderOg } from "@/lib/og";

export const alt = "Motivational interviewing role-play scenarios from Affirming Antelope";
export const size = ogSize;
export const contentType = ogContentType;

export default function Image() {
  return renderOg({
    eyebrow: "Role-play scenarios",
    title: "Pick the conversation you want to rehearse.",
    subtitle: "Team conversations and patient visits, easy to hard.",
  });
}

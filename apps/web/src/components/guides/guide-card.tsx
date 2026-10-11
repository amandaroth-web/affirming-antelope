import Link from "next/link";
import type { Guide, GuideAudience } from "@/lib/guides";

export const audienceLabel: Record<GuideAudience, string> = {
  clinicians: "For clinicians",
  leaders: "For leaders",
  trainers: "For trainers",
  all: "MI guide",
};

export function GuideCard({ guide }: { guide: Pick<Guide, "slug" | "title" | "description" | "readingMinutes" | "audience"> }) {
  return (
    <Link
      href={`/guides/${guide.slug}`}
      className="group flex h-full flex-col rounded-[1.25rem] border-2 border-line bg-white p-5 shadow-[0_5px_0_var(--shadow)] transition-[transform,box-shadow,border-color] duration-100 ease-out hover:-translate-y-0.5 hover:border-primary-tint hover:shadow-[0_7px_0_var(--shadow)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <span className="text-xs font-extrabold uppercase tracking-[0.08em] text-primary-shadow">
        {audienceLabel[guide.audience]} · {guide.readingMinutes} min
      </span>
      <span className="mt-2 font-display text-xl font-bold leading-snug text-ink group-hover:text-primary-shadow">
        {guide.title}
      </span>
      <span className="mt-2 line-clamp-3 flex-1 font-semibold leading-snug text-muted">{guide.description}</span>
    </Link>
  );
}

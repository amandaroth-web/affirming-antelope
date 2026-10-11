import { ArrowRight, Lightbulb, Target, X } from "@phosphor-icons/react/dist/ssr";
import type { MDXComponents } from "mdx/types";
import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { getDrill, getSkill } from "@antelope/core";
import { drillHref } from "@/lib/site";

type ExampleKind = "open-question" | "reflection" | "complex-reflection" | "affirmation" | "summary" | "avoid";

/** `color` is the move family (bubble border); `chip` is a darker shade that holds white text at AA. */
const kinds: Record<ExampleKind, { label: string; color: string; chip: string }> = {
  "open-question": { label: "Open question", color: "var(--move-question)", chip: "#374FBF" },
  reflection: { label: "Reflection", color: "var(--move-reflection)", chip: "#226B60" },
  "complex-reflection": { label: "Complex reflection", color: "var(--move-reflection)", chip: "#226B60" },
  affirmation: { label: "Affirmation", color: "var(--move-support)", chip: "var(--move-support)" },
  summary: { label: "Summary", color: "var(--move-support)", chip: "var(--move-support)" },
  avoid: { label: "Avoid", color: "var(--move-inconsistent)", chip: "#9C4E28" },
};

/** One line of a conversation. The practitioner ("You") sits on the right. */
export function Example({
  speaker = "Employee",
  kind,
  children,
}: {
  speaker?: string;
  kind?: ExampleKind;
  children: ReactNode;
}) {
  const mine = speaker.toLowerCase() === "you" || Boolean(kind);
  const k = kind ? kinds[kind] : undefined;
  const avoid = kind === "avoid";

  if (!mine) {
    return (
      <figure className="my-3 flex max-w-[34rem] flex-col items-start">
        <figcaption className="mb-1 pl-1 text-xs font-extrabold uppercase tracking-[0.06em] text-muted">
          {speaker}
        </figcaption>
        <blockquote className="rounded-2xl rounded-tl-md border-2 border-line bg-soft px-4 py-3 text-[1.05rem] font-bold leading-snug text-ink shadow-[0_3px_0_var(--shadow)] [&>p]:m-0">
          {children}
        </blockquote>
      </figure>
    );
  }

  return (
    <figure className="my-3 ml-auto flex max-w-[34rem] flex-col items-end">
      <figcaption className="mb-1 flex items-center gap-2 pr-1 text-xs font-extrabold uppercase tracking-[0.06em] text-muted">
        {speaker}
        {k && (
          <span
            className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 normal-case tracking-normal text-white"
            style={{ backgroundColor: k.chip }}
          >
            {avoid && <X size={11} weight="bold" aria-hidden />}
            {k.label}
          </span>
        )}
      </figcaption>
      <blockquote
        className={`rounded-2xl rounded-tr-md border-2 bg-white px-4 py-3 text-[1.05rem] font-bold leading-snug shadow-[0_3px_0_var(--shadow)] [&>p]:m-0 ${
          avoid ? "border-dashed text-muted" : "text-ink"
        }`}
        style={{ borderColor: k?.color ?? "var(--primary)" }}
      >
        {children}
      </blockquote>
    </figure>
  );
}

export function Callout({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <aside className="my-8 flex gap-4 rounded-[1.25rem] border-2 border-gold/50 bg-gold-tint/60 p-5">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gold text-ink shadow-[0_3px_0_var(--gold-shadow)]">
        <Lightbulb size={20} weight="bold" aria-hidden />
      </span>
      <div className="min-w-0 [&>p:first-child]:mt-0 [&>p:last-child]:mb-0 [&>p]:my-2">
        {title && <p className="font-display text-lg font-bold text-ink">{title}</p>}
        <div className="font-semibold leading-relaxed text-ink [&>p]:my-2 [&>p:first-child]:mt-1 [&>p:last-child]:mb-0">
          {children}
        </div>
      </div>
    </aside>
  );
}

/** A real drill from @antelope/core, deep-linked into the learner app. */
export function TryDrill({ id, label, slug }: { id: string; label?: string; slug: string }) {
  const drill = getDrill(id);
  const href = drillHref(id, slug);
  const track = {
    "data-track": "guide_drill_clicked",
    "data-track-slug": slug,
    "data-track-drill-id": id,
  };

  if (!drill) {
    if (process.env.NODE_ENV !== "production") console.warn(`[guides] TryDrill: unknown drill id "${id}" in ${slug}`);
    return null;
  }
  const skill = getSkill(drill.skill);

  return (
    <aside
      aria-label={label ?? "Try this drill"}
      className="not-prose my-10 overflow-hidden rounded-[1.75rem] border-2 border-primary-shadow bg-primary text-primary-ink shadow-[0_6px_0_var(--primary-shadow)]"
    >
      <div className="flex items-center gap-3 px-5 pt-5 md:px-6">
        <span className="flex size-10 items-center justify-center rounded-xl bg-gold text-ink shadow-[0_3px_0_var(--gold-shadow)]">
          <Target size={20} weight="bold" aria-hidden />
        </span>
        <div>
          <p className="font-display text-lg font-bold leading-tight">{label ?? "Try this drill"}</p>
          <p className="text-sm font-bold text-white">
            {skill.name} · about 2 minutes · free
          </p>
        </div>
      </div>
      <div className="m-3 mt-4 rounded-[1.25rem] bg-white p-4 text-ink md:m-4 md:p-5">
        <p className="text-sm font-bold text-muted">{drill.context}</p>
        <blockquote className="mt-3 rounded-2xl rounded-tl-md border-2 border-line bg-soft px-4 py-3 font-bold leading-snug">
          <span className="block text-xs font-extrabold uppercase tracking-[0.06em] text-primary-shadow">
            {drill.speaker}
          </span>
          “{drill.prompt}”
        </blockquote>
        <p className="mt-4 font-display text-lg font-bold">{drill.instruction}</p>
        <a
          href={href}
          {...track}
          className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-[15px] font-extrabold uppercase tracking-wide text-primary-ink shadow-[0_5px_0_var(--primary-shadow)] transition-[transform,box-shadow,filter] duration-75 ease-out hover:brightness-105 active:translate-y-1 active:shadow-[0_0_0_var(--primary-shadow)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          Answer it in the app
          <ArrowRight size={16} weight="bold" aria-hidden />
        </a>
      </div>
    </aside>
  );
}

const heading = "scroll-mt-24 font-display font-bold tracking-tight text-ink";

function A({ href = "", children, ...rest }: ComponentPropsWithoutRef<"a">) {
  const cls =
    "font-bold text-primary-shadow underline decoration-primary/40 decoration-2 underline-offset-[3px] hover:decoration-primary";
  if (href.startsWith("/") || href.startsWith("#")) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} className={cls} rel="noopener" {...rest}>
      {children}
    </a>
  );
}

/** Element styles for long reads, plus the guide components (bound to a slug). */
export function guideComponents(slug: string): MDXComponents {
  return {
    h2: (p) => <h2 {...p} className={`${heading} mt-14 mb-4 text-[1.75rem] leading-tight md:text-3xl`} />,
    h3: (p) => <h3 {...p} className={`${heading} mt-10 mb-3 text-xl md:text-[1.4rem]`} />,
    h4: (p) => <h4 {...p} className={`${heading} mt-8 mb-2 text-lg`} />,
    p: (p) => <p {...p} className="my-5" />,
    a: A,
    ul: (p) => <ul {...p} className="my-5 list-disc space-y-2 pl-6 marker:text-primary" />,
    ol: (p) => <ol {...p} className="my-5 list-decimal space-y-2 pl-6 marker:font-extrabold marker:text-primary-shadow" />,
    li: (p) => <li {...p} className="pl-1" />,
    strong: (p) => <strong {...p} className="font-extrabold text-ink" />,
    blockquote: (p) => (
      <blockquote {...p} className="my-6 border-l-4 border-primary-tint pl-5 font-semibold text-muted italic" />
    ),
    hr: () => <hr className="my-12 border-t-2 border-line" />,
    code: (p) => <code {...p} className="rounded-md bg-soft px-1.5 py-0.5 text-[0.92em] font-bold text-primary-shadow" />,
    table: (p) => (
      <div className="my-6 overflow-x-auto rounded-[1.25rem] border-2 border-line">
        <table {...p} className="w-full border-collapse text-left text-[0.95rem]" />
      </div>
    ),
    th: (p) => <th {...p} className="border-b-2 border-line bg-soft px-4 py-2.5 font-extrabold text-ink" />,
    td: (p) => <td {...p} className="border-b-2 border-soft px-4 py-2.5 align-top" />,
    Example,
    Callout,
    TryDrill: (p: { id: string; label?: string }) => <TryDrill {...p} slug={slug} />,
  };
}

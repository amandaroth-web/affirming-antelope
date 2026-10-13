import "server-only";

import fs from "node:fs";
import path from "node:path";
import GithubSlugger from "github-slugger";
import { parse as parseYaml } from "yaml";

/**
 * Guides live in apps/web/content/guides/<slug>.mdx. The format contract is
 * content/guides/README.md. Everything here runs at build time (the guide routes
 * are fully static), so reading the filesystem is fine.
 */

export type GuideAudience = "clinicians" | "leaders" | "trainers" | "all";

export type GuideFrontmatter = {
  title: string;
  description: string;
  keywords: string[];
  audience: GuideAudience;
  /** ISO date (YYYY-MM-DD). */
  updated: string;
  readingMinutes: number;
  drillId?: string;
  related: string[];
  faq: { q: string; a: string }[];
  /** Slug of a person in lib/people.ts who reviewed the guide. Omit until they have. */
  reviewedBy?: string;
  /** ISO date (YYYY-MM-DD) of that review. */
  reviewedOn?: string;
  draft: boolean;
};

export type Guide = GuideFrontmatter & {
  slug: string;
  body: string;
};

export type GuideHeading = { depth: 2 | 3; text: string; id: string };

const GUIDES_DIR = path.join(process.cwd(), "content", "guides");
const AUDIENCES: GuideAudience[] = ["clinicians", "leaders", "trainers", "all"];

function toIsoDate(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  return new Date().toISOString().slice(0, 10);
}

function asStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function splitFrontmatter(raw: string): { data: Record<string, unknown>; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw);
  if (!match) return { data: {}, body: raw };
  const data = (parseYaml(match[1]) ?? {}) as Record<string, unknown>;
  return { data, body: raw.slice(match[0].length) };
}

function wordCount(body: string) {
  return body
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<[^>]+>/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
}

function readGuide(file: string): Guide {
  const slug = file.replace(/\.mdx$/, "");
  const raw = fs.readFileSync(path.join(GUIDES_DIR, file), "utf8");
  const { data, body } = splitFrontmatter(raw);
  const audience = AUDIENCES.includes(data.audience as GuideAudience)
    ? (data.audience as GuideAudience)
    : "all";
  const faq = Array.isArray(data.faq)
    ? (data.faq as unknown[])
        .map((f) => f as { q?: unknown; a?: unknown })
        .filter((f) => typeof f.q === "string" && typeof f.a === "string")
        .map((f) => ({ q: String(f.q), a: String(f.a) }))
    : [];
  const minutes = Number(data.readingMinutes);
  return {
    slug,
    body,
    title: String(data.title ?? slug),
    description: String(data.description ?? ""),
    keywords: asStrings(data.keywords),
    audience,
    updated: toIsoDate(data.updated),
    readingMinutes: Number.isFinite(minutes) && minutes > 0 ? minutes : Math.max(1, Math.round(wordCount(body) / 220)),
    drillId: typeof data.drillId === "string" ? data.drillId : undefined,
    related: asStrings(data.related),
    faq,
    reviewedBy: typeof data.reviewedBy === "string" && data.reviewedBy.trim() ? data.reviewedBy.trim() : undefined,
    reviewedOn: data.reviewedOn ? toIsoDate(data.reviewedOn) : undefined,
    draft: data.draft === true,
  };
}

let cache: Guide[] | undefined;

function loadAll(): Guide[] {
  if (cache && process.env.NODE_ENV === "production") return cache;
  const files = fs.existsSync(GUIDES_DIR)
    ? fs.readdirSync(GUIDES_DIR).filter((f) => f.endsWith(".mdx"))
    : [];
  cache = files.map(readGuide).sort((a, b) => (a.updated < b.updated ? 1 : a.updated > b.updated ? -1 : a.title.localeCompare(b.title)));
  return cache;
}

/** Published guides, newest first. Pass `includeDrafts` for routing only. */
export function getAllGuides({ includeDrafts = false } = {}): Guide[] {
  const all = loadAll();
  return includeDrafts ? all : all.filter((g) => !g.draft);
}

export function getGuide(slug: string): Guide | undefined {
  return loadAll().find((g) => g.slug === slug);
}

/** Related guides: the ones named in frontmatter first, then same-audience, all published. */
export function getRelatedGuides(guide: Guide, limit = 3): Guide[] {
  const published = getAllGuides().filter((g) => g.slug !== guide.slug);
  const named = guide.related
    .map((slug) => published.find((g) => g.slug === slug))
    .filter((g): g is Guide => Boolean(g));
  const rest = published.filter(
    (g) => !named.includes(g) && (g.audience === guide.audience || g.audience === "all" || guide.audience === "all"),
  );
  return [...named, ...rest].slice(0, limit);
}

/** Strip inline markdown so heading text matches what rehype-slug sees. */
function plainText(md: string) {
  return md
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_~]/g, "")
    .trim();
}

/** `##` and `###` headings for the table of contents, with rehype-slug ids. */
export function getHeadings(body: string): GuideHeading[] {
  const slugger = new GithubSlugger();
  const out: GuideHeading[] = [];
  let inFence = false;
  for (const line of body.split("\n")) {
    if (/^\s*```/.test(line)) inFence = !inFence;
    if (inFence) continue;
    const m = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (!m) continue;
    const text = plainText(m[2]);
    // Slug every heading in order, as rehype-slug does, so ids stay in sync.
    const id = slugger.slug(text);
    const depth = m[1].length;
    if (depth === 2 || depth === 3) out.push({ depth, text, id });
  }
  return out;
}

export function formatDate(iso: string) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

import { SITE_URL } from "@/lib/site";

/**
 * The people named on the site. Only facts they have given us.
 */
/**
 * Whether to name a person's current employer (Headway, for Amanda) in copy and JSON-LD.
 * Amanda must approve employer naming before this ships. Set to false to remove every
 * mention of it: the sentence on her page and `worksFor` in her Person JSON-LD.
 */
export const showCurrentEmployer = true;

type Org = { name: string; url?: string };

export type Person = {
  slug: string;
  /** schema.org `name`, without the credential. */
  name: string;
  /** Credential, shown after the name and used as `honorificSuffix`. */
  credential?: string;
  /** Name as shown on the page, e.g. "Amanda Roth, LCSW". */
  displayName: string;
  jobTitle?: string;
  /** One line under the name, e.g. "LCSW · Member, ..." */
  credentialLine?: string;
  /** Professional bodies, as schema.org `memberOf`. */
  memberOf?: Org[];
  /** Current employer. Only used when `showCurrentEmployer` is true. */
  employer?: Org;
  /** Path to a page about them, when there is one. */
  page?: string;
  photo?: { src: string; width: number; height: number; alt: string };
  sameAs: string[];
};

export const AMANDA: Person = {
  slug: "amanda-roth",
  name: "Amanda Roth",
  credential: "LCSW",
  displayName: "Amanda Roth, LCSW",
  jobTitle: "Principal, Psychotherapy Clinical Quality",
  credentialLine: "LCSW · Member, Motivational Interviewing Network of Trainers (MINT)",
  memberOf: [
    { name: "Motivational Interviewing Network of Trainers", url: "https://motivationalinterviewing.org" },
    { name: "Association for Talent Development", url: "https://www.td.org" },
  ],
  employer: { name: "Headway" },
  page: "/about/amanda-roth",
  photo: { src: "/team/amanda-roth.jpg", width: 500, height: 500, alt: "Portrait of Amanda Roth, LCSW" },
  sameAs: ["https://www.linkedin.com/in/akbrownell/"],
};

export const BLAKE: Person = {
  slug: "blake-parkinson",
  name: "Blake Parkinson",
  displayName: "Blake Parkinson",
  sameAs: [],
};

const PEOPLE: Person[] = [AMANDA, BLAKE];

export function getPerson(slug: string): Person | undefined {
  return PEOPLE.find((p) => p.slug === slug);
}

export function personId(p: Person) {
  return `${SITE_URL}${p.page ?? "/about"}#${p.slug}`;
}

/**
 * Amanda's bio, as she gave it. The sentence naming her employer is gated by
 * `showCurrentEmployer`; Amanda must approve the bio and the employer mention before merge.
 */
export function amandaBio(): string[] {
  const employer = showCurrentEmployer && AMANDA.employer ? AMANDA.employer.name : undefined;
  return [
    "Amanda Roth is a licensed clinical social worker and a member of the Motivational Interviewing Network of Trainers (MINT) and the Association for Talent Development (ATD). She has spent more than ten years in clinical operations, quality improvement, and learning and development.",
    `${
      employer
        ? `She is Principal, Psychotherapy Clinical Quality at ${employer}. Before that she was Head of Quality at Two Chairs`
        : "She was Head of Quality at Two Chairs"
    }, where she led clinical learning, development and quality assurance. She has also held senior roles at Calm, Vida Health and Vital Decisions, building onboarding programs, performance metrics and quality improvement work.`,
    "Across those roles she has designed and scaled Motivational Interviewing training for clinicians, coaches and leaders. The MI for Leaders program behind Affirming Antelope comes from that work.",
  ];
}

/**
 * Written for Amanda; she approves the wording. Renders only when non-empty.
 * Shared by the home method block and her page.
 */
export const AMANDA_QUOTE =
  "Workshops teach the skill in an afternoon. The hard part comes the week after, when someone pushes back and you hear yourself starting to lecture. I wanted something for that week.";

/**
 * A short note from the founders. Blake wrote this text; Amanda reads it before it ships.
 * Lives on /about.
 */
export const WHY_WE_BUILT: { heading: string; body: string[]; signedBy: string } = {
  heading: "Why we built this",
  body: [
    "Amanda has coached a lot of healthcare leaders through the conversations they dread: the late reports, the quiet team member, the change nobody asked for. The leaders she works with get better at them. But she can only sit in on so many one-on-ones.",
    "So we built a place to put everything she teaches. The 12-week path follows her MI for Leaders program, and every role-play is written to respond the way her learners’ employees do. Now people can practice her approach between sessions, on their own time.",
  ],
  signedBy: "Blake Parkinson",
};

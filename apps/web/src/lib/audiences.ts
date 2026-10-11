import { DRILLS, MI_FOR_LEADERS, SCENARIOS } from "@antelope/core";
import type { Audience } from "@/lib/site";

export type AudienceIcon =
  | "target"
  | "chat"
  | "chart"
  | "path"
  | "review"
  | "users"
  | "clock"
  | "lock"
  | "assign"
  | "browser";

export type AudiencePage = {
  slug: Audience;
  /** Short name for nav, breadcrumbs, and the OG image. */
  name: string;
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
  eyebrow: string;
  h1: string;
  lede: string;
  /** Hero showcase card. */
  showcase: "drill" | "pathway" | "cohort";
  pains: { title: string; body: string }[];
  painsHeading: string;
  steps: { title: string; body: string }[];
  stepsHeading: string;
  features: { title: string; body: string; icon: AudienceIcon }[];
  featuresHeading: string;
  faq: { q: string; a: string }[];
  closingHeading: string;
  closingBody: string;
  /** schema.org audienceType for SoftwareApplication. */
  audienceType: string;
};

const drillCount = DRILLS.length;
const scenarioCount = SCENARIOS.length;
const weeks = MI_FOR_LEADERS.units.length;
const weekMinutes = MI_FOR_LEADERS.units.map((u) =>
  u.activities.reduce((sum, a) => sum + a.minutes, 0),
);
const minWeek = Math.min(...weekMinutes);
const maxWeek = Math.max(...weekMinutes);

export const AUDIENCES: Record<Audience, AudiencePage> = {
  clinicians: {
    slug: "clinicians",
    name: "Clinicians",
    metaTitle: "Motivational interviewing practice for clinicians",
    metaDescription:
      "Free MI practice for physicians, nurses, therapists, and coaches. Five-minute OARS drills and AI role-plays that keep your reflections sharp between trainings.",
    keywords: [
      "motivational interviewing practice for clinicians",
      "motivational interviewing for nurses",
      "motivational interviewing for physicians",
      "OARS practice",
      "reflective listening practice",
    ],
    eyebrow: "For physicians, nurses, therapists, and coaches",
    h1: "Keep your MI sharp between trainings.",
    lede: "You learned OARS in a workshop. Then the clinic got busy and the closed questions crept back. Five minutes of practice a day keeps the skill where you can reach it.",
    showcase: "drill",
    painsHeading: "The workshop was good. Then Monday happened.",
    pains: [
      {
        title: "The skill fades fast",
        body: "A two-day training gives you the ideas. Without practice and feedback, skills drift back toward old habits within months.",
      },
      {
        title: "Nobody hears you do it",
        body: "Getting a real session coded takes a recording and a trained coder. Most people never get feedback at all.",
      },
      {
        title: "Advice comes out first",
        body: "You know the righting reflex. Under time pressure it still wins, because it's the habit you've rehearsed most.",
      },
    ],
    stepsHeading: "Practice, notice, use it.",
    steps: [
      {
        title: "One short drill",
        body: "Read what they said, then answer with the move the drill asks for: an open question, a complex reflection, an affirmation.",
      },
      {
        title: "See what you did",
        body: "Feedback names the move you actually made and whether it hit the target, with an example of one that does.",
      },
      {
        title: "Have the whole conversation",
        body: "When you're ready, run a role-play with someone who has their own reasons for staying stuck, then read the debrief.",
      },
    ],
    featuresHeading: "What you'll practice",
    features: [
      {
        icon: "target",
        title: `${drillCount} drills across the MI skills`,
        body: "OARS, engaging, focusing, evoking, change talk, sustain talk, discord, and planning. Each one takes a few minutes.",
      },
      {
        icon: "chat",
        title: `${scenarioCount} live role-plays`,
        body: "Each person has a backstory you don't see. Reflect well and they open up. Argue, and they dig in, like people do.",
      },
      {
        icon: "chart",
        title: "A debrief you can act on",
        body: "A count of your open and closed questions and simple and complex reflections, the key moments, and one thing to try next.",
      },
      {
        icon: "browser",
        title: "Nothing to install",
        body: "It runs in your phone's browser, so it fits between patients. Start as a guest and sign in later to keep your streak.",
      },
    ],
    faq: [
      {
        q: "Are the role-plays patient conversations?",
        a: "Not yet. Today's role-plays are workplace conversations in healthcare settings, with people like a medical assistant, a charge nurse, and a practice manager. OARS, reflections, and responding to sustain talk work the same way in a patient visit, and the drills practice exactly those moves.",
      },
      {
        q: "Is it really free?",
        a: "Yes. The drills, the role-plays, and the 12-week pathway are free, and you don't need a card. You can start as a guest without an account.",
      },
      {
        q: "Does it count toward CE or CME credit?",
        a: "No. Affirming Antelope isn't an accredited course and doesn't award credit. Use it to keep practicing between the trainings that do.",
      },
      {
        q: "Should I type in real patient details?",
        a: "No. Every scenario is fictional, and your replies are processed by an AI model to play the other person and write feedback. Keep real patient and colleague information out of it.",
      },
      {
        q: "Is there a phone app?",
        a: "The learner app works in any browser, on your phone or laptop, at app.affirmingantelope.com. An iOS app is coming.",
      },
    ],
    closingHeading: "Five minutes before clinic.",
    closingBody: "Open it in your browser and do one drill. If it helps, do another tomorrow.",
    audienceType: "Clinicians, nurses, therapists, and health coaches",
  },

  leaders: {
    slug: "leaders",
    name: "Healthcare leaders",
    metaTitle: "Motivational interviewing for healthcare leaders",
    metaDescription:
      "Practice MI for performance conversations with AI role-plays of realistic employees. A free 12-week MI for Leaders pathway for healthcare managers and supervisors.",
    keywords: [
      "motivational interviewing for leaders",
      "motivational interviewing for managers",
      "motivational interviewing performance management",
      "difficult conversations practice healthcare",
    ],
    eyebrow: "For managers, supervisors, and charge nurses",
    h1: "Rehearse the hard conversation before you have it.",
    lede: "Late reports, a quiet team member, a change nobody asked for. Practice with an AI employee who has their own reasons, so the real conversation isn't your first try.",
    showcase: "pathway",
    painsHeading: "You can't practice on your team.",
    pains: [
      {
        title: "Telling doesn't stick",
        body: "You've explained the expectation twice. It still isn't happening, and a third explanation won't change that.",
      },
      {
        title: "The stakes are real",
        body: "A performance conversation that goes sideways costs trust you don't get back quickly. It's a bad place to learn.",
      },
      {
        title: "Training is a one-off",
        body: "Leadership workshops happen once a year. The conversations happen every week.",
      },
    ],
    stepsHeading: "Practice, notice, use it.",
    steps: [
      {
        title: "Read the brief",
        body: "Who they are, what's been happening, and your goal for the conversation. Their first line is waiting.",
      },
      {
        title: "Have the conversation",
        body: "They answer the way people do. Reflect what you hear and they start to talk about change. Push, and they push back.",
      },
      {
        title: "Read the debrief",
        body: "See where they moved toward change, where they dug in, and the moments that turned it. Then try again or go harder.",
      },
    ],
    featuresHeading: "Built for the conversations you actually have",
    features: [
      {
        icon: "chat",
        title: "Realistic employees",
        body: `${scenarioCount} role-plays drawn from healthcare work: missed deadlines, a reliable MA gone quiet, a new process nobody wanted, a charge nurse who found out by memo.`,
      },
      {
        icon: "path",
        title: `The ${weeks}-week MI for Leaders pathway`,
        body: `Short lessons, drills, and role-plays in order, from foundations to advanced practice. Most weeks take ${minWeek} to ${maxWeek} minutes in total.`,
      },
      {
        icon: "users",
        title: "Expectations and autonomy together",
        body: "Leadership drills practice holding a clear standard while leaving the how up to them, without sliding into a lecture.",
      },
      {
        icon: "review",
        title: "Feedback from a trainer, if you want it",
        body: "Join a trainer's cohort and choose which role-plays to send for review. Nothing is shared unless you send it.",
      },
    ],
    faq: [
      {
        q: "Isn't motivational interviewing for patients?",
        a: "It started in addiction treatment and is used widely in healthcare. The same skills help any time you need someone to change and can't make them: open questions, reflections, and drawing out their own reasons.",
      },
      {
        q: "What's in the 12-week pathway?",
        a: "Foundations, the spirit of MI, engaging, focusing, evoking, planning, integration, self-coding, leadership and MI, and two weeks of advanced practice. Each week mixes short lessons and drills, with a role-play every week from week three on.",
      },
      {
        q: "How much time does it take?",
        a: `Each activity takes three to ten minutes. A pathway week is ${minWeek} to ${maxWeek} minutes in total, and you can split it across days.`,
      },
      {
        q: "Can my managers practice together?",
        a: "Yes. A trainer can set up a cohort, assign practice with due dates, and review the role-plays people submit. See the page for trainers.",
      },
      {
        q: "Is it free?",
        a: "Yes. The practice app is free and runs in your browser. No card, no download.",
      },
    ],
    closingHeading: "Practice the next one-on-one first.",
    closingBody: "Start with the week one lessons, or jump straight into a role-play.",
    audienceType: "Healthcare managers, supervisors, and team leads",
  },

  trainers: {
    slug: "trainers",
    name: "MI trainers",
    metaTitle: "Motivational interviewing practice for MI trainers",
    metaDescription:
      "Give your MI cohort practice between sessions. Assign drills and role-plays, track who's practicing, and review the role-plays learners submit. Free to start.",
    keywords: [
      "motivational interviewing training tools",
      "MI trainer practice platform",
      "motivational interviewing coaching feedback",
      "motivational interviewing cohort",
    ],
    eyebrow: "For MI trainers and training programs",
    h1: "Give your cohort practice between sessions.",
    lede: "Your workshop teaches the skill. What happens in the weeks after decides whether it sticks. Assign practice, see who's doing it, and coach the role-plays learners send you.",
    showcase: "cohort",
    painsHeading: "Most practice happens where you can't see it.",
    pains: [
      {
        title: "Homework disappears",
        body: "You suggest practicing reflections with a partner. A few people do. You don't find out who until the next session.",
      },
      {
        title: "Coding is slow",
        body: "Reviewing a recorded session properly takes time you don't have for every learner, every week.",
      },
      {
        title: "Feedback arrives late",
        body: "By the time notes come back, the learner has forgotten the conversation they're about.",
      },
    ],
    stepsHeading: "Run a cohort in three steps.",
    steps: [
      {
        title: "Create a cohort",
        body: "Get a join code. Learners enter it in the app and show up on your participants list.",
      },
      {
        title: "Assign practice",
        body: "Pick drills on a skill, a specific drill, a role-play scenario, or a pathway lesson, and set a due date.",
      },
      {
        title: "Review what they send",
        body: "Learners choose which role-plays to submit. Read the transcript, rate it, and leave written or recorded feedback.",
      },
    ],
    featuresHeading: "What the trainer dashboard does",
    features: [
      {
        icon: "users",
        title: "Who's practicing",
        body: "Each participant's assigned and completed work, what needs review, and when they were last active.",
      },
      {
        icon: "assign",
        title: "Assignments from the library",
        body: `${drillCount} drills, ${scenarioCount} role-plays, and the ${weeks}-week pathway's lessons. Learners see your instructions and due date in the app.`,
      },
      {
        icon: "review",
        title: "Review with your voice",
        body: "Rate a role-play, write or record feedback, recommend what to practice next, and ask for another try.",
      },
      {
        icon: "lock",
        title: "Opt-in by design",
        body: "You see practice counts for your cohort. You only see a conversation when the learner chooses to send it.",
      },
    ],
    faq: [
      {
        q: "How do I get trainer access?",
        a: "Sign in to the trainer dashboard with your email and enter a trainer code. Trainer access is in early access, so codes come from your program lead or from us directly.",
      },
      {
        q: "What do learners need?",
        a: "Just a browser. They open the app, sign in, and enter your cohort's join code. Assignments and your feedback show up in the app.",
      },
      {
        q: "Can I see every conversation my learners have?",
        a: "No. You see progress for the work you assign. Transcripts reach you only when a learner submits a role-play for review, and they can withdraw it.",
      },
      {
        q: "Can I write my own scenarios?",
        a: "Not yet. Assignments come from the built-in library of drills, role-plays, and pathway lessons. Every scenario is fictional.",
      },
      {
        q: "What does it cost?",
        a: "There's no charge today for trainers or learners.",
      },
    ],
    closingHeading: "Set up your first cohort.",
    closingBody: "Sign in, create a cohort, and share the join code at your next session.",
    audienceType: "Motivational Interviewing trainers and training programs",
  },
};

export const AUDIENCE_SLUGS = Object.keys(AUDIENCES) as Audience[];

export function getAudience(slug: string): AudiencePage | undefined {
  return (AUDIENCES as Record<string, AudiencePage>)[slug];
}

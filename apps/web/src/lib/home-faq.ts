import { MI_FOR_LEADERS } from "@antelope/core";
import { PRICING_LINE } from "./site";

/** Home page FAQ. Rendered as the accordion and as FAQPage JSON-LD, so keep it plain text. */
export const HOME_FAQ: { q: string; a: string }[] = [
  {
    q: "Is what I say private?",
    a: "The scenarios are fictional, so leave out real names and identifying details. What you type or say becomes a transcript in your account. Voice audio isn't stored. Your trainer only sees the sessions you choose to share.",
  },
  {
    q: "Do I need MI training first?",
    a: `No. It works best alongside MI training, and the ${MI_FOR_LEADERS.units.length}-week MI for Leaders path starts from the basics.`,
  },
  {
    q: "How is this different from asking ChatGPT to role-play?",
    a: "You get a structured path instead of a blank chat. Each employee is written from a scenario spec and responds to your MI skill: more defensive when lectured, more open when reflected. Feedback points to specific MI moves, never a score. And your trainer can be in the loop.",
  },
  {
    q: "Can I say it out loud?",
    a: "Yes. On any role-play, hold to talk and say your reply. The employee answers in their own voice. You can type instead whenever you like.",
  },
  {
    q: "What does it cost?",
    a: PRICING_LINE,
  },
  {
    q: "Is there an app?",
    a: "It works in your browser on any phone or laptop, with nothing to install. An iOS app is coming.",
  },
];

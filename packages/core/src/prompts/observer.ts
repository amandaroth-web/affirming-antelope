// DRAFT — pending trainer review
// Observer: MI-informed analysis only. Codes each turn of a finished
// role-play. It does not teach or give feedback (that's the Coach) and it
// does not count (tallies and trajectory are computed in code below).

import type { LearnerMove, MoveTallies, ScenarioSpec, Turn, TurnAnnotation } from "../types";

/** Minimal JSON Schema shape accepted as a Claude tool input_schema / structured output schema. */
export interface JsonObjectSchema {
  type: "object";
  properties: Record<string, unknown>;
  required: string[];
  additionalProperties: false;
  [key: string]: unknown;
}

export const LEARNER_MOVES: LearnerMove[] = [
  "open-question",
  "closed-question",
  "simple-reflection",
  "complex-reflection",
  "affirmation",
  "summary",
  "giving-information",
  "advice-with-permission",
  "emphasize-autonomy",
  "seeking-collaboration",
  "advice-without-permission",
  "confront",
  "other",
];

/** Moves counted as MI-inconsistent in tallies. */
export const MI_INCONSISTENT_MOVES: LearnerMove[] = ["advice-without-permission", "confront"];

export function observerSystemPrompt(spec: ScenarioSpec): string {
  return `You are an experienced Motivational Interviewing coder. You code practice conversations using an approach informed by MITI 4.2 (Motivational Interviewing Treatment Integrity), adapted for leaders talking with employees at work. You produce careful, consistent behavior codes. You do not give feedback, teach, or judge; a separate coach does that, and a human trainer is the final authority.

<scenario>
A leader (the "learner") practiced a conversation with a simulated employee.
Employee: ${spec.persona.name}, ${spec.persona.role}
Context: ${spec.context}
Issue: ${spec.leadershipIssue}
The learner's goal: ${spec.learnerGoal}
Target behavior for change talk: the employee doing something different about "${spec.leadershipIssue}" (and closely related behaviors the conversation focuses on). Change talk and sustain talk are judged relative to this target, not relative to general mood.
</scenario>

<task>
Code every turn in the transcript, exactly once, in order, using the turn ids given. Learner turns get a "move". Employee turns get "talk", "intensity", and "stance". Every turn gets a short "note".
</task>

<learner_move_codes>
Code one move per learner turn. If a turn contains several behaviors, pick using this priority order and mention the other behavior in the note:
confront > advice-without-permission > summary > complex-reflection > simple-reflection > affirmation > emphasize-autonomy > seeking-collaboration > advice-with-permission > open-question > closed-question > giving-information > other

open-question: A question that invites a wide range of answers and lets the employee decide what to say. "What," "how," "tell me about." Imperatives that function as questions ("Tell me more about that") count as open questions.

closed-question: A question answerable with yes/no, a short fact, or a choice between options. "Is it the workload?" "Did you get my email?" "Would Monday or Tuesday work?" "Is there anything else?" is closed. Note: MITI 4.2 itself does not split open and closed questions; this app does, for learning purposes.

simple-reflection: A statement that conveys understanding by repeating or lightly rephrasing what the employee said, adding little or no new meaning. "You're behind on the reports." "It's been a hard week."

complex-reflection: A statement that adds substantial meaning or emphasis beyond what the employee said: naming an unspoken feeling, value, or meaning; a double-sided reflection ("On one hand... and on the other..."); continuing the paragraph (guessing what they'd say next); a metaphor; or a deliberately amplified reflection said without sarcasm.

Reflection vs question: Code by form, not intent. A reflection that ends in a question mark or is phrased to get confirmation ("So you're frustrated?", "It sounds like you're overwhelmed, is that right?") is coded as closed-question, because in text the question mark signals a question. A statement without a question mark is a reflection even if it's tentative ("It sounds like...", "I'm guessing...").

summary: A reflection that gathers two or more things the employee said earlier (not just the last turn) into one statement. Often starts "So let me see if I've got this" or ends with a check-in question; still code it as summary.

affirmation: A genuine statement that recognizes the employee's specific strengths, efforts, intentions, or values. It is about them. "You've kept this team running through two vacancies." "You really care about getting it right for patients."
Edge cases: generic praise ("Great job," "Awesome") or the learner's approval ("I'm proud of you," "I like that") is coded other, with a note. Agreement ("Exactly," "Right") is other. Sarcastic "affirmation" is confront.

giving-information: Sharing facts, expectations, policy, or feedback in a neutral way without pressure to change. "The deadline is the third business day." "Finance needs the report before they can close."
advice-with-permission: Advice or suggestions offered with permission. Permission counts when: the employee asked for advice or input; the learner asked "Would it be okay if I shared an idea?" and the employee agreed; or the learner clearly hands the choice back ("This may or may not fit, you'd know better").

advice-without-permission: Trying to change the employee's mind or behavior through suggestions, arguments, logic, or persuasive information, when they haven't asked and the learner hasn't asked permission. "Have you tried time-blocking?" "You should delegate the supply orders." "If you just started earlier, you'd be fine." A question that is really a suggestion ("Have you thought about...?", "Why don't you...?") is advice-without-permission, not a question.

confront: Directly disagreeing, arguing, correcting, criticizing, blaming, shaming, labeling, moralizing, warning, threatening, or questioning the employee's honesty. Also: sarcasm, "I understand, but..." where the "but" argues back, and reflections that clearly carry judgment ("So you just don't care about the team"). Mentioning consequences in a pressuring or threatening way is confront; stating a real consequence once, neutrally, is giving-information.

emphasize-autonomy: Explicitly naming the employee's choice, control, or ability to decide. "It's your call how you handle this." "You know your team better than I do." If it is also clearly a reflection or an open question, code the reflection or question instead.

seeking-collaboration: Inviting partnership on the conversation itself, sharing power over the agenda or the solution. "I'd like to figure this out together." "What would you like to focus on?" when it is about the direction of the conversation rather than its content.

other: Anything that fits none of the above: greetings, small talk, structuring ("Let's take a few minutes on this"), self-disclosure that isn't persuasive, generic praise, agreement, filler.
</learner_move_codes>

<employee_codes>
talk: Judge only what the employee says about the target behavior.
- change: Any statement leaning toward change. Desire ("I want to get back on top of this"), ability ("I could block Friday mornings"), reasons ("The team can't close without me"), need ("I have to fix this"), commitment ("I'll send it by Wednesday"), activation ("I'm ready to try"), taking steps ("I already asked Jamal").
- sustain: Any statement leaning toward the status quo: reasons it's fine, can't change, don't want to, it's someone else's problem, it doesn't matter. "Nobody reads them until the 10th anyway." "It's faster if I just do it."
- neutral: Statements unrelated to the target behavior, factual answers, small talk, questions about logistics, and statements evenly balanced between change and sustain.

Leadership-context edge cases:
- Surface compliance to the boss ("Fine. Whatever you want." "Sure, I'll do it.") said flatly or under pressure is not change talk. Code sustain (or neutral if genuinely ambiguous) and note it as compliance.
- Conditional statements: "I'd do it if the template weren't broken" is sustain (the barrier is the point). "If I fixed the template, I could get it done" is change (ability).
- Complaints about the organization are sustain only if they function as reasons not to change; otherwise neutral.
- Agreeing with the learner's reflection ("Yeah, exactly") takes the talk value of the reflection it agrees with.
- Discord (pushback aimed at the learner: "You don't get to tell me how to do my job") is a stance, not a talk code. Code talk as sustain if it also argues for the status quo, otherwise neutral.

intensity: one integer from -2 to +2.
+2: strong change: commitment, activation, taking steps, or emphatic desire or need.
+1: mild or tentative change: "I guess I could," "I don't love being the bottleneck."
 0: neutral, or change and sustain in balance.
-1: mild sustain: a reason or hedge, said without heat.
-2: strong sustain or discord: firm refusal, emphatic dismissal, hostility, sarcasm aimed at the learner.

stance: where the employee is at that moment in the conversation, considering this turn and its tone.
- sustain: mostly defending the status quo.
- ambivalent: voicing both sides, or wavering.
- change: mostly leaning toward doing something different.
- discord: friction with the learner personally (defending, interrupting, blaming the learner, sarcasm, disengaging from the learner).
</employee_codes>

<notes>
Each note is one short sentence (under 15 words) in plain language that says what happened, not how good it was. Never use "correct," "incorrect," "good," "bad," "should," or scores.
Examples: "Reflected the frustration under the complaint." "Asked permission before sharing the deadline." "Suggested a fix before hearing his view." "First change talk: doesn't want to be the bottleneck." "Flat compliance, not real commitment."
</notes>

Code consistently. When unsure between two codes, choose the one a careful MITI coder would choose and say why in the note.`;
}

function speakerLabel(speaker: Turn["speaker"]): string {
  return speaker === "learner" ? "Leader" : "Employee";
}

export function formatTranscript(turns: Turn[]): string {
  return turns.map((t) => `[${t.id}] ${speakerLabel(t.speaker)} (${t.speaker}): ${t.text}`).join("\n");
}

export function observerUserPrompt(turns: Turn[]): string {
  return `<transcript>
${formatTranscript(turns)}
</transcript>

Code all ${turns.length} turns in order. Use the exact turn ids in brackets.`;
}

const STANCE_ENUM = ["sustain", "ambivalent", "change", "discord"];

export const OBSERVER_SCHEMA: JsonObjectSchema = {
  type: "object",
  properties: {
    annotations: {
      type: "array",
      description: "One annotation per transcript turn, in order.",
      items: {
        type: "object",
        properties: {
          turnId: { type: "string", description: "The id of the turn being coded." },
          speaker: { type: "string", enum: ["learner", "employee"] },
          move: {
            type: "string",
            enum: LEARNER_MOVES,
            description: "Learner turns only.",
          },
          talk: {
            type: "string",
            enum: ["change", "sustain", "neutral"],
            description: "Employee turns only.",
          },
          intensity: {
            type: "integer",
            enum: [-2, -1, 0, 1, 2],
            description: "Employee turns only. -2 strong sustain/discord to +2 strong change.",
          },
          stance: {
            type: "string",
            enum: STANCE_ENUM,
            description: "Employee turns only.",
          },
          note: {
            type: "string",
            description: "One short plain-language sentence describing what happened.",
          },
        },
        required: ["turnId", "speaker", "note"],
        additionalProperties: false,
      },
    },
  },
  required: ["annotations"],
  additionalProperties: false,
};

/** Deterministic counts from Observer annotations. */
export function computeTallies(annotations: TurnAnnotation[]): MoveTallies {
  const tallies: MoveTallies = {
    openQuestions: 0,
    closedQuestions: 0,
    simpleReflections: 0,
    complexReflections: 0,
    affirmations: 0,
    summaries: 0,
    autonomySupport: 0,
    miInconsistent: 0,
  };
  for (const a of annotations) {
    if (a.speaker !== "learner" || !a.move) continue;
    switch (a.move) {
      case "open-question":
        tallies.openQuestions++;
        break;
      case "closed-question":
        tallies.closedQuestions++;
        break;
      case "simple-reflection":
        tallies.simpleReflections++;
        break;
      case "complex-reflection":
        tallies.complexReflections++;
        break;
      case "affirmation":
        tallies.affirmations++;
        break;
      case "summary":
        tallies.summaries++;
        break;
      case "emphasize-autonomy":
      case "seeking-collaboration":
      case "advice-with-permission":
        tallies.autonomySupport++;
        break;
      case "advice-without-permission":
      case "confront":
        tallies.miInconsistent++;
        break;
      default:
        break;
    }
  }
  return tallies;
}

/**
 * Employee intensity per employee turn, in transcript order. Turns the
 * Observer skipped or left without an intensity count as 0.
 */
export function computeTrajectory(annotations: TurnAnnotation[], turns: Turn[]): number[] {
  const byId = new Map<string, TurnAnnotation>();
  for (const a of annotations) byId.set(a.turnId, a);
  return turns
    .filter((t) => t.speaker === "employee")
    .map((t) => {
      const intensity = byId.get(t.id)?.intensity;
      return typeof intensity === "number" ? intensity : 0;
    });
}

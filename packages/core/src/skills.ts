// DRAFT — pending trainer review

import type { Skill, SkillId, SkillLevel, SkillLevelNumber } from "./types";

export const SKILLS: Skill[] = [
  {
    id: "oars",
    name: "OARS",
    tagline: "Open questions, affirmations, reflections, and summaries. The basics you'll use in every conversation.",
  },
  {
    id: "engaging",
    name: "Engaging",
    tagline: "Build enough trust that the real conversation can happen.",
  },
  {
    id: "focusing",
    name: "Focusing",
    tagline: "Agree on what this conversation is actually about.",
  },
  {
    id: "evoking",
    name: "Evoking",
    tagline: "Draw out their reasons for change instead of supplying your own.",
  },
  {
    id: "planning",
    name: "Planning",
    tagline: "When they're ready, help them shape a plan they own.",
  },
  {
    id: "change-talk",
    name: "Change talk",
    tagline: "Hear the words that lean toward change, and help them grow.",
  },
  {
    id: "sustain-talk",
    name: "Sustain talk",
    tagline: "Meet reasons for staying the same without arguing.",
  },
  {
    id: "discord",
    name: "Discord",
    tagline: "When the relationship gets tense, step beside them instead of pushing back.",
  },
  {
    id: "leadership",
    name: "Leading with MI",
    tagline: "Hold clear expectations and still leave room for their choices.",
  },
  {
    id: "full-conversation",
    name: "Full conversation",
    tagline: "Put it all together in one real conversation, start to finish.",
  },
];

export const SKILL_LEVELS: SkillLevel[] = [
  { level: 1, name: "Recognize", question: "Can you spot it when you hear it?" },
  { level: 2, name: "Respond", question: "Can you respond to it on purpose?" },
  { level: 3, name: "Elicit", question: "Can you draw it out?" },
  { level: 4, name: "Sustain", question: "Can you keep going when they push back?" },
  { level: 5, name: "Integrate", question: "Can you do it all within a real conversation?" },
  { level: 6, name: "Advanced", question: "Can you stay with MI when the conversation gets difficult?" },
];

type LevelQuestions = Record<SkillLevelNumber, string>;

const SKILL_LEVEL_QUESTIONS: Partial<Record<SkillId, LevelQuestions>> = {
  oars: {
    1: "Can you tell an open question from a closed one, and a reflection from a question?",
    2: "Can you offer a simple reflection or an open question when you choose to?",
    3: "Can you use complex reflections and summaries to deepen the conversation?",
    4: "Can you keep reflecting when the other person pushes back?",
    5: "Can you reflect more than you ask across a whole conversation?",
    6: "Can you keep your reflections accurate when emotions run high?",
  },
  engaging: {
    1: "Can you notice when a conversation is building trust, and when it isn't?",
    2: "Can you respond to what matters to them before your own agenda?",
    3: "Can you invite them to say what's really going on?",
    4: "Can you stay curious when they're guarded or short with you?",
    5: "Can you build and keep engagement through a whole conversation?",
    6: "Can you rebuild trust after a conversation goes sideways?",
  },
  focusing: {
    1: "Can you tell when a conversation has a clear focus, and when it's drifting?",
    2: "Can you ask permission before raising your topic?",
    3: "Can you help them choose a focus from several concerns?",
    4: "Can you hold the focus when they steer away from it?",
    5: "Can you find a shared focus within a real conversation?",
    6: "Can you balance a required topic with what they care about when it gets tense?",
  },
  evoking: {
    1: "Can you identify change talk?",
    2: "Can you respond to change talk when you hear it?",
    3: "Can you evoke change talk with your questions and reflections?",
    4: "Can you respond skillfully to sustain talk?",
    5: "Can you do all of this within a conversation?",
    6: "Can you maintain MI when the conversation becomes difficult?",
  },
  planning: {
    1: "Can you recognize when someone is ready to talk about a plan?",
    2: "Can you ask what they'd like to do next instead of telling them?",
    3: "Can you draw out a plan in their own words?",
    4: "Can you strengthen commitment when they hesitate?",
    5: "Can you move from evoking to planning within a conversation?",
    6: "Can you plan together when expectations are non-negotiable?",
  },
  "change-talk": {
    1: "Can you tell desire, ability, reasons, and need from commitment?",
    2: "Can you reflect change talk back to them?",
    3: "Can you ask questions that invite more change talk?",
    4: "Can you find the change talk inside a mostly negative statement?",
    5: "Can you keep change talk growing across a conversation?",
    6: "Can you hear faint change talk under frustration or discord?",
  },
  "sustain-talk": {
    1: "Can you identify sustain talk?",
    2: "Can you reflect sustain talk without arguing?",
    3: "Can you use double-sided reflections to show both sides?",
    4: "Can you stay steady when sustain talk keeps coming?",
    5: "Can you soften sustain talk over a whole conversation?",
    6: "Can you work with sustain talk when you have real stakes in the outcome?",
  },
  discord: {
    1: "Can you tell discord apart from sustain talk?",
    2: "Can you reflect discord without defending yourself?",
    3: "Can you shift focus or apologize to lower the tension?",
    4: "Can you emphasize their autonomy when they push back on you?",
    5: "Can you recover from discord within a conversation?",
    6: "Can you stay with MI when the discord is aimed at you?",
  },
  leadership: {
    1: "Can you spot the difference between directing and guiding?",
    2: "Can you share an expectation and still invite their view?",
    3: "Can you elicit their ideas before offering yours?",
    4: "Can you hold accountability without falling into the righting reflex?",
    5: "Can you lead a full performance conversation in an MI-consistent way?",
    6: "Can you use MI when the stakes are high for you, them, and the team?",
  },
  "full-conversation": {
    1: "Can you recognize engaging, focusing, evoking, and planning in a conversation?",
    2: "Can you respond in a way that fits where the conversation is?",
    3: "Can you move a conversation forward without rushing it?",
    4: "Can you hold the conversation together when it stalls?",
    5: "Can you run a full conversation from start to finish?",
    6: "Can you do it when the conversation is difficult?",
  },
};

export function getSkill(id: SkillId): Skill {
  const skill = SKILLS.find((s) => s.id === id);
  if (!skill) throw new Error(`Unknown skill: ${id}`);
  return skill;
}

export function getSkillLevel(level: SkillLevelNumber): SkillLevel {
  return SKILL_LEVELS[level - 1];
}

/** Skill-specific version of the level question, falling back to the generic one. */
export function skillLevelQuestion(skill: SkillId, level: SkillLevelNumber): string {
  return SKILL_LEVEL_QUESTIONS[skill]?.[level] ?? getSkillLevel(level).question;
}

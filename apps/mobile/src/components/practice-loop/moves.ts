import type { LearnerMove, MoveTallies, Stance } from '@antelope/core';
import { moveColor } from '@/design/tokens';

/**
 * Plain-language names for MITI move codes. The learner never sees the codes.
 * Families drive colour + marker shape in the replay chart, legend and tallies.
 */
export type MoveFamily = keyof typeof moveColor;

export const MOVE: Record<LearnerMove, { label: string; family: MoveFamily }> = {
  'open-question': { label: 'Open question', family: 'question' },
  'closed-question': { label: 'Closed question', family: 'question' },
  'simple-reflection': { label: 'Simple reflection', family: 'reflection' },
  'complex-reflection': { label: 'Complex reflection', family: 'reflection' },
  summary: { label: 'Summary', family: 'reflection' },
  affirmation: { label: 'Affirmation', family: 'support' },
  'emphasize-autonomy': { label: 'Autonomy support', family: 'support' },
  'seeking-collaboration': { label: 'Seeking collaboration', family: 'support' },
  'advice-with-permission': { label: 'Advice with permission', family: 'support' },
  'giving-information': { label: 'Sharing information', family: 'neutral' },
  other: { label: 'Something else', family: 'neutral' },
  'advice-without-permission': { label: 'Advice without asking', family: 'inconsistent' },
  confront: { label: 'Pushing back', family: 'inconsistent' },
};

export const FAMILY: Record<MoveFamily, { label: string; shape: 'circle' | 'diamond' | 'square' | 'triangle' | 'dot' }> = {
  question: { label: 'Questions', shape: 'circle' },
  reflection: { label: 'Reflections', shape: 'diamond' },
  support: { label: 'Affirm & autonomy', shape: 'square' },
  inconsistent: { label: 'Telling or pushing', shape: 'triangle' },
  neutral: { label: 'Other', shape: 'dot' },
};

export function moveLabel(m?: LearnerMove): string {
  return m ? MOVE[m]?.label ?? 'Response' : 'Response';
}

/** Moves that read as an activity, not a countable thing: no article ("That landed as sharing information"). */
const MASS: Partial<Record<LearnerMove, true>> = {
  'giving-information': true,
  'emphasize-autonomy': true,
  'seeking-collaboration': true,
  'advice-with-permission': true,
  'advice-without-permission': true,
  confront: true,
  other: true,
};

/** "a complex reflection" / "an open question" / "sharing information". */
export function movePhrase(m?: LearnerMove): string {
  const l = moveLabel(m).toLowerCase();
  if (m && MASS[m]) return l;
  return `${/^[aeiou]/.test(l) ? 'an' : 'a'} ${l}`;
}

export type ZoneKey = 'change' | 'mixed' | 'hold';

export const ZONE: Record<ZoneKey, { label: string }> = {
  change: { label: 'Open to change' },
  mixed: { label: 'Mixed' },
  hold: { label: 'Holding on' },
};

export function zoneOf(intensity: number): ZoneKey {
  if (intensity >= 0.67) return 'change';
  if (intensity <= -0.67) return 'hold';
  return 'mixed';
}

export function stanceLabel(s?: Stance, intensity?: number): string {
  if (s === 'discord') return 'Pushing back';
  if (s === 'change') return 'Open to change';
  if (s === 'sustain') return 'Holding on';
  if (s === 'ambivalent') return 'Mixed';
  return ZONE[zoneOf(intensity ?? 0)].label;
}

/** Tally rows in display order, grouped by family. */
export const TALLY_ROWS: { key: keyof MoveTallies; label: string; family: MoveFamily }[] = [
  { key: 'openQuestions', label: 'Open questions', family: 'question' },
  { key: 'closedQuestions', label: 'Closed questions', family: 'question' },
  { key: 'simpleReflections', label: 'Simple reflections', family: 'reflection' },
  { key: 'complexReflections', label: 'Complex reflections', family: 'reflection' },
  { key: 'summaries', label: 'Summaries', family: 'reflection' },
  { key: 'affirmations', label: 'Affirmations', family: 'support' },
  { key: 'autonomySupport', label: 'Autonomy support', family: 'support' },
  { key: 'miInconsistent', label: 'Telling or pushing', family: 'inconsistent' },
];

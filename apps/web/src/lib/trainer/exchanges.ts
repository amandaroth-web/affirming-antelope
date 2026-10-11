import type { Debrief, LearnerMove, Stance, Turn } from "@antelope/core";

/** Mirrors apps/mobile/src/components/roleplay/Debrief.tsx buildExchanges. */
export interface Exchange {
  /** 0 = the opening line; k = the k-th learner turn and the reply to it. */
  index: number;
  value: number;
  employee: Turn;
  employeeNote?: string;
  stance?: Stance;
  learner?: Turn;
  move?: LearnerMove;
  learnerNote?: string;
  keyMoment: boolean;
}

/** Pair each employee turn with the learner turn that prompted it, plus the observer's notes. */
export function buildExchanges(turns: Turn[], d: Debrief): Exchange[] {
  const ann = new Map(d.annotations.map((a) => [a.turnId, a]));
  const keys = new Set(d.keyMoments.map((k) => k.turnId));
  const employee = turns.filter((t) => t.speaker === "employee");
  return employee.map((e, i) => {
    const at = turns.indexOf(e);
    const prev = turns[at - 1];
    const learner = prev?.speaker === "learner" ? prev : undefined;
    const ea = ann.get(e.id);
    const la = learner ? ann.get(learner.id) : undefined;
    const raw = d.trajectory[i] ?? ea?.intensity ?? 0;
    return {
      index: i,
      value: Number.isFinite(raw) ? Math.max(-2, Math.min(2, raw)) : 0,
      employee: e,
      employeeNote: ea?.note,
      stance: ea?.stance,
      learner,
      move: la?.move,
      learnerNote: la?.note,
      keyMoment: !!learner && keys.has(learner.id),
    };
  });
}

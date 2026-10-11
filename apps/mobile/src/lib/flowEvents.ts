/**
 * The account flows (sign in, join a cohort) are full screens presented over
 * whatever asked for them. Callers that hand off mid-task (the review sheet) listen
 * for the flow closing so they can carry on where the learner left off. Focus
 * events aren't enough here: a sheet over a practice modal doesn't always blur it.
 */
type Flow = 'sign-in' | 'join';
const listeners = new Set<(flow: Flow) => void>();

export function emitFlowClosed(flow: Flow) {
  listeners.forEach((l) => l(flow));
}

export function onFlowClosed(l: (flow: Flow) => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

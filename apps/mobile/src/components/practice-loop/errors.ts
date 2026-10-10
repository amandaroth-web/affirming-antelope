import { ApiError } from '@/lib/api';

export interface FriendlyError {
  title: string;
  detail: string;
}

/** Turn a failed request into coach-voice copy. Never blames the learner, always keeps their words. */
export function friendlyError(err: unknown): FriendlyError {
  if (err instanceof ApiError) {
    if (err.status === 429) return { title: 'Lots of practice right now', detail: 'Give it a few seconds, then try again.' };
    if (err.status >= 500 || err.status === 503) return { title: 'The coach hit a snag', detail: 'That one’s on us. Try again in a moment.' };
    return { title: 'That didn’t go through', detail: 'Try again in a moment.' };
  }
  const name = (err as { name?: string })?.name;
  if (name === 'AbortError' || name === 'TimeoutError') return { title: 'This is taking longer than usual', detail: 'The connection may be slow. Try again.' };
  return { title: 'You might be offline', detail: 'Check your connection, then try again.' };
}

/** AbortController that also fires after `ms`. Call `clear()` when done. */
export function withTimeout(ms: number, outer?: AbortSignal) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  outer?.addEventListener('abort', () => ctrl.abort());
  return { signal: ctrl.signal, abort: () => ctrl.abort(), clear: () => clearTimeout(t) };
}

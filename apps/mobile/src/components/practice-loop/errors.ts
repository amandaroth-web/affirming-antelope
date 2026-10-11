import { ApiError } from '@/lib/api';
import { useAccount } from '@/state/account';

export interface FriendlyError {
  title: string;
  detail: string;
  /**
   * What kind of stop this is, so screens pick the icon and the copy around it.
   *   offline  never reached the coach (the default)
   *   wait     a practice limit (burst or daily) or the AI is resting: nothing is broken
   *   snag     the server failed
   */
  kind: 'offline' | 'wait' | 'snag';
  /** A guest hit today's free limit: offer "Save your progress" (sign in for more). */
  signIn?: boolean;
}

/** "in 20 seconds", "in a few minutes", "at 6:00 PM", "tomorrow". */
export function whenAgain(retryAfterSec: number | undefined, now = new Date()): string {
  const s = Math.max(1, Math.round(retryAfterSec ?? 60));
  if (s < 50) return `in ${s} seconds`;
  if (s < 90) return 'in a minute';
  if (s < 15 * 60) return 'in a few minutes';
  const at = new Date(now.getTime() + s * 1000);
  if (at.toDateString() !== now.toDateString()) return 'tomorrow';
  return `at ${at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
}

/** Turn a failed request into coach-voice copy. Never blames the learner, always keeps their words. */
export function friendlyError(err: unknown): FriendlyError {
  if (err instanceof ApiError) {
    if (err.status === 429 && err.code === 'quota_exceeded' && err.reason === 'daily') {
      const when = whenAgain(err.retryAfter);
      if (useAccount.getState().status !== 'signed-in') {
        return {
          kind: 'wait',
          signIn: true,
          title: 'That’s today’s free practice',
          detail: `You put in real work today. More opens up ${when}, or save your progress with your email to keep going.`,
        };
      }
      return { kind: 'wait', title: 'That’s a full day of practice', detail: `Let it settle. More opens up ${when}.` };
    }
    if (err.status === 429) {
      return { kind: 'wait', title: 'Let’s take a breath', detail: `That’s a lot of practice in a short time. Try again ${whenAgain(err.retryAfter)}.` };
    }
    if (err.status === 503 && err.code === 'ai_resting') {
      return { kind: 'wait', title: 'The coach is resting', detail: `Practice AI is taking a break. Try again ${whenAgain(err.retryAfter)}.` };
    }
    if (err.status === 401) return { kind: 'offline', title: 'The coach couldn’t check you in', detail: 'Check your connection, then try again.' };
    if (err.status >= 500) return { kind: 'snag', title: 'The coach hit a snag', detail: 'That one’s on us. Try again in a moment.' };
    return { kind: 'snag', title: 'That didn’t go through', detail: 'Try again in a moment.' };
  }
  const name = (err as { name?: string })?.name;
  if (name === 'AbortError' || name === 'TimeoutError') return { kind: 'offline', title: 'This is taking longer than usual', detail: 'The connection may be slow. Try again.' };
  return { kind: 'offline', title: 'You might be offline', detail: 'Check your connection, then try again.' };
}

/** AbortController that also fires after `ms`. Call `clear()` when done. */
export function withTimeout(ms: number, outer?: AbortSignal) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  outer?.addEventListener('abort', () => ctrl.abort());
  return { signal: ctrl.signal, abort: () => ctrl.abort(), clear: () => clearTimeout(t) };
}

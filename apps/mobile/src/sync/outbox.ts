import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Json, TablesInsert } from '@antelope/core';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { errorCode, isTransient, supabase } from '@/lib/supabase';
import { uuid } from '@/lib/uuid';
import type { PracticeRecord, PracticeSession } from '@/state/store';

/**
 * Persisted outbox. Every write the app makes on the learner's behalf goes through
 * here, so it survives being offline, the app being killed, and flaky networks.
 *
 * - Ops are idempotent (client ids + ignore-duplicates, or plain updates), so a
 *   retry after an ambiguous failure is always safe.
 * - Ops for one user flush strictly in order (a submission needs its session).
 *   Consecutive completions / sessions are batched into one request.
 * - A transient failure (network, 5xx, expired token) stops the flush and retries
 *   with exponential backoff (2s → 5 min, with jitter). A permanent failure (RLS,
 *   constraint) drops that op and keeps going, so one bad row never blocks the queue.
 * - Ops are tagged with the user they belong to and only flush while that user is
 *   signed in.
 */

type CompletionRow = Omit<TablesInsert<'activity_completions'>, 'id' | 'user_id'>;
type SessionRow = Omit<TablesInsert<'practice_sessions'>, 'user_id'>;

export type Op =
  | { type: 'completion'; row: CompletionRow }
  | { type: 'session'; row: SessionRow }
  | {
      type: 'submission';
      row: {
        id: string;
        session_id: string;
        cohort_id: string;
        note_to_trainer: string | null;
      };
    }
  | { type: 'withdraw'; submissionId: string }
  | { type: 'seen'; reviewId: string; at: string };

export interface Entry {
  id: string;
  userId: string;
  op: Op;
  attempts: number;
  /** Epoch ms before which this entry isn't retried. */
  nextAt: number;
  lastError?: string;
}

interface OutboxState {
  entries: Entry[];
  /** learner_state needs pushing for these users (coalesced; not an entry). */
  stateDirty: Record<string, boolean>;
  /** Ops dropped after a permanent failure (kept short, for diagnostics). */
  dropped: { op: Op['type']; error: string; at: string }[];
  /** The last flush stopped on a network failure (not persisted; drives "waiting" copy). */
  stalled: boolean;
  enqueue: (userId: string, ops: Op[]) => void;
  markStateDirty: (userId: string, dirty: boolean) => void;
  /** Hand one user's waiting ops to another (a guest merged into an account). Rows carry no user id. */
  rekey: (fromUserId: string, toUserId: string) => void;
  /** Sign-out: forget every waiting op, whoever it belonged to. */
  clear: () => void;
}

export const useOutbox = create<OutboxState>()(
  persist(
    (set) => ({
      entries: [],
      stateDirty: {},
      dropped: [],
      stalled: false,
      enqueue: (userId, ops) =>
        set((s) => ({
          entries: [
            ...s.entries,
            ...ops.map((op) => ({
              id: uuid(),
              userId,
              op,
              attempts: 0,
              nextAt: 0,
            })),
          ],
        })),
      clear: () => set({ entries: [], stateDirty: {}, dropped: [], stalled: false }),
      markStateDirty: (userId, dirty) => set((s) => ({ stateDirty: { ...s.stateDirty, [userId]: dirty } })),
      rekey: (fromUserId, toUserId) =>
        set((s) => {
          const { [fromUserId]: was, ...stateDirty } = s.stateDirty;
          return {
            entries: s.entries.map((e) => (e.userId === fromUserId ? { ...e, userId: toUserId, nextAt: 0 } : e)),
            stateDirty: was ? { ...stateDirty, [toUserId]: true } : stateDirty,
          };
        }),
    }),
    {
      name: 'antelope.outbox.v1',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      partialize: ({ entries, stateDirty, dropped }) => ({
        entries,
        stateDirty,
        dropped,
      }),
    },
  ),
);

// ---------------------------------------------------------------------------
// Row builders
// ---------------------------------------------------------------------------

export function completionOp(r: PracticeRecord): Op | null {
  if (!r.refId) return null;
  return {
    type: 'completion',
    row: {
      client_id: r.id,
      kind: r.kind,
      ref_id: r.refId,
      activity_id: r.activityId ?? null,
      skill: r.skill ?? null,
      minutes: Math.max(0, Math.min(600, Math.round(r.minutes))),
      completed_at: r.at,
    },
  };
}

export function sessionOp(s: PracticeSession): Op {
  return {
    type: 'session',
    row: {
      id: s.id,
      client_id: s.id,
      kind: s.kind,
      ref_id: s.refId,
      skill: s.skill ?? null,
      mode: s.mode ?? 'text',
      transcript: s.transcript as unknown as NonNullable<Json>,
      debrief: (s.debrief ?? null) as unknown as Json,
      self_reflection: (s.selfReflection ?? null) as unknown as Json,
      started_at: s.startedAt,
      ended_at: s.endedAt,
      duration_sec: Math.max(0, Math.round(s.durationSec)),
    },
  };
}

// ---------------------------------------------------------------------------
// Flush
// ---------------------------------------------------------------------------

const BASE_MS = 2_000;
const MAX_MS = 5 * 60_000;
const BATCH = 100;

export function backoff(attempts: number): number {
  const ms = Math.min(MAX_MS, BASE_MS * 2 ** Math.max(0, attempts - 1));
  return Math.round(ms * (0.8 + Math.random() * 0.4));
}

class Transient extends Error {}

async function send(entries: Entry[]): Promise<void> {
  const head = entries[0].op;
  let error: unknown = null;
  if (head.type === 'completion') {
    const rows = entries.map((e) => (e.op as Extract<Op, { type: 'completion' }>).row);
    ({ error } = await supabase.from('activity_completions').upsert(rows, {
      onConflict: 'user_id,client_id',
      ignoreDuplicates: true,
    }));
  } else if (head.type === 'session') {
    const rows = entries.map((e) => (e.op as Extract<Op, { type: 'session' }>).row);
    ({ error } = await supabase.from('practice_sessions').upsert(rows, {
      onConflict: 'user_id,client_id',
      ignoreDuplicates: true,
    }));
  } else if (head.type === 'submission') {
    ({ error } = await supabase.from('submissions').insert(head.row));
    // 23505: either this exact row is already there (a retry after a lost response), or the
    // session already has an active submission (sent from another device). Both mean "it's
    // submitted": treat as sent; the flush then refreshes, and reconcile() swaps the optimistic
    // row for the server's.
    if (errorCode(error) === '23505') error = null;
  } else if (head.type === 'withdraw') {
    ({ error } = await supabase.from('submissions').update({ status: 'withdrawn' }).eq('id', head.submissionId).eq('status', 'submitted'));
  } else if (head.type === 'seen') {
    ({ error } = await supabase.from('reviews').update({ learner_seen_at: head.at }).eq('id', head.reviewId).is('learner_seen_at', null));
  }
  if (error) {
    if (isTransient(error)) throw new Transient((error as { message?: string }).message ?? 'network');
    throw error;
  }
}

/** Entries at the head of `list` that can go in one request. */
function takeBatch(list: Entry[]): Entry[] {
  const t = list[0].op.type;
  if (t !== 'completion' && t !== 'session') return [list[0]];
  const out: Entry[] = [];
  for (const e of list) {
    if (e.op.type !== t || out.length >= BATCH) break;
    out.push(e);
  }
  return out;
}

export interface FlushResult {
  sent: number;
  /** Earliest time a retry makes sense, when something is still waiting. */
  retryAt: number | null;
}

/**
 * Send this user's queued ops in order. Never throws. Stops at the first transient
 * failure and reports when to retry.
 */
export async function flushOps(userId: string): Promise<FlushResult> {
  let sent = 0;
  for (;;) {
    const mine = useOutbox.getState().entries.filter((e) => e.userId === userId);
    if (!mine.length) return { sent, retryAt: null };
    const head = mine[0];
    if (head.nextAt > Date.now()) return { sent, retryAt: head.nextAt };
    const batch = takeBatch(mine);
    const ids = new Set(batch.map((e) => e.id));
    try {
      await send(batch);
      useOutbox.setState((s) => ({
        entries: s.entries.filter((e) => !ids.has(e.id)),
      }));
      sent += batch.length;
    } catch (e) {
      const message = (e as { message?: string })?.message ?? String(e);
      if (e instanceof Transient) {
        const attempts = head.attempts + 1;
        const nextAt = Date.now() + backoff(attempts);
        useOutbox.setState((s) => ({
          stalled: true,
          entries: s.entries.map((x) => (ids.has(x.id) ? { ...x, attempts, nextAt, lastError: message } : x)),
        }));
        return { sent, retryAt: nextAt };
      }
      // permanent: drop it so it can't block the queue, and keep a note
      console.warn(`[outbox] dropped ${head.op.type}: ${message}`);
      useOutbox.setState((s) => ({
        entries: s.entries.filter((x) => !ids.has(x.id)),
        dropped: [{ op: head.op.type, error: message, at: new Date().toISOString() }, ...s.dropped].slice(0, 20),
      }));
    }
  }
}

/** Retry now (foreground, reconnect, pull-to-refresh): clear the backoff for this user. */
export function resetBackoff(userId: string) {
  useOutbox.setState((s) => ({
    entries: s.entries.map((e) => (e.userId === userId ? { ...e, nextAt: 0 } : e)),
  }));
}

export function pendingCount(userId: string | undefined): number {
  if (!userId) return 0;
  return useOutbox.getState().entries.filter((e) => e.userId === userId).length;
}

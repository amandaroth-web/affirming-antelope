import type { AuthChangeEvent, RealtimeChannel, Session } from '@supabase/supabase-js';
import * as Network from 'expo-network';
import { AppState } from 'react-native';
import { uuid } from '@/lib/uuid';
import { onSimulatedOfflineChange, setCurrentSession, supabase, supabaseConfigured } from '@/lib/supabase';
import { useAccount, type Submission } from '@/state/account';
import { hadLearnerData, setRecordOwner, SYNCED_KEYS, useLearner, type PracticeSession } from '@/state/store';
import { refreshCloud } from './cloud';
import { adoptOnSignIn, applyingRemote, pullState, pushState } from './learnerState';
import { backoff, completionOp, flushOps, resetBackoff, sessionOp, useOutbox, type Op } from './outbox';

/**
 * The sync engine. Starts once at launch (`startSync`) and then:
 *
 *   auth      INITIAL_SESSION / SIGNED_IN → owner for new records, guest migration,
 *             learner_state adopt-or-merge, flush, refresh. SIGNED_OUT → guest (local
 *             practice stays; the account cache is cleared).
 *   practice  a new completion or session in the learner store → outbox op.
 *             A change to the synced part of the state → learner_state marked dirty.
 *   flush     on enqueue (debounced), foreground, reconnect, sign-in and a backoff
 *             timer. Outbox ops first (in order), then learner_state.
 *   refresh   cloud data on sign-in, foreground (throttled), reconnect, pull-to-refresh,
 *             after a flush that changed progress, and on Realtime review events.
 *
 * Guest mode and offline are the normal case: nothing here blocks the UI.
 */

let started = false;
let user: { id: string; email: string } | null = null;
let flushing: Promise<void> | null = null;
let again = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let stateAttempts = 0;
let lastRefresh = 0;
let channel: RealtimeChannel | null = null;

export function currentUserId(): string | undefined {
  return user?.id;
}

// ---------------------------------------------------------------------------
// Flush
// ---------------------------------------------------------------------------

function scheduleRetry(at: number) {
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = setTimeout(
    () => {
      retryTimer = null;
      void flush();
    },
    Math.max(250, at - Date.now()),
  );
}

/** Send everything waiting for the signed-in user. Coalesces concurrent calls. */
export function flush(): Promise<void> {
  if (!user) return Promise.resolve();
  if (flushing) {
    again = true;
    return flushing;
  }
  flushing = (async () => {
    do {
      again = false;
      const u = user;
      if (!u) break;
      const before = useOutbox
        .getState()
        .entries.filter((e) => e.userId === u.id)
        .map((e) => e.op.type);
      const res = await flushOps(u.id);
      let retryAt = res.retryAt;
      if (useOutbox.getState().stateDirty[u.id] && retryAt === null) {
        useOutbox.getState().markStateDirty(u.id, false);
        try {
          await pushState(u.id);
          stateAttempts = 0;
        } catch {
          useOutbox.getState().markStateDirty(u.id, true);
          useOutbox.setState({ stalled: true });
          stateAttempts += 1;
          retryAt = Date.now() + backoff(stateAttempts);
        }
      }
      if (retryAt === null) useOutbox.setState({ stalled: false });
      if (retryAt !== null) scheduleRetry(retryAt);
      // progress the trainer cares about moved: pull fresh assignment progress / submissions
      if (res.sent && before.slice(0, res.sent).some((t) => t !== 'seen')) scheduleRefresh(600);
    } while (again);
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}

function flushSoon(ms = 1200) {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void flush();
  }, ms);
}

function enqueue(ops: Op[]) {
  if (!user || !ops.length) return;
  useOutbox.getState().enqueue(user.id, ops);
  flushSoon(300);
}

// ---------------------------------------------------------------------------
// Refresh
// ---------------------------------------------------------------------------

/** Pull cloud data + learner_state. Safe to call often; returns when done. */
export async function refresh(): Promise<void> {
  const u = user;
  if (!u) return;
  lastRefresh = Date.now();
  try {
    if (await pullState(u.id)) {
      useOutbox.getState().markStateDirty(u.id, true);
      flushSoon(0);
    }
  } catch {
    // offline: the cache stays; refreshCloud records `offline`
  }
  await refreshCloud(u.id, u.email);
}

function scheduleRefresh(ms: number) {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    refreshTimer = null;
    void refresh();
  }, ms);
}

/** Foreground / reconnect / pull-to-refresh: retry now, then refresh. */
export async function syncNow(): Promise<void> {
  if (!user) return;
  resetBackoff(user.id);
  stateAttempts = 0;
  await flush();
  await refresh();
}

// ---------------------------------------------------------------------------
// Auth transitions
// ---------------------------------------------------------------------------

function guestWork() {
  const s = useLearner.getState();
  return {
    completions: s.practiceLog.filter((r) => !r.ownerId),
    sessions: s.sessions.filter((r) => !r.ownerId),
  };
}

async function signedIn(session: Session, fresh: boolean) {
  const id = session.user.id;
  const email = session.user.email ?? '';
  const acct = useAccount.getState();
  if (acct.profile && acct.profile.id !== id) acct.clearAccount();
  user = { id, email };
  setRecordOwner(id);
  useAccount.getState().set({
    status: 'signed-in',
    // a fresh sign-in finishes its own flow (name step) before leaving the welcome
    ...(fresh ? null : { onboarded: true }),
    profile: useAccount.getState().profile ?? {
      id,
      email,
      displayName: '',
      needsName: false,
    },
  });

  // Guest practice on this device now belongs to this account.
  const work = guestWork();
  const hasGuestWork = work.completions.length + work.sessions.length > 0;
  const dirty = !!useOutbox.getState().stateDirty[id];
  try {
    const needsPush = fresh ? await adoptOnSignIn(id, hasGuestWork || dirty) : await pullState(id);
    if (needsPush) useOutbox.getState().markStateDirty(id, true);
  } catch {
    // offline right after sign-in: push what we have when the network is back
    if (fresh) useOutbox.getState().markStateDirty(id, true);
  }
  if (hasGuestWork) {
    const ops: Op[] = [...work.sessions.map(sessionOp), ...work.completions.map(completionOp).filter((o): o is Op => !!o)];
    useOutbox.getState().enqueue(id, ops);
    useLearner.getState().claimRecords(
      id,
      work.completions.map((r) => r.id),
      work.sessions.map((r) => r.id),
    );
  }

  subscribeRealtime(id);
  await flush();
  await refreshCloud(id, email);
}

function signedOut() {
  user = null;
  setRecordOwner(undefined);
  if (channel) {
    void supabase.removeChannel(channel);
    channel = null;
  }
  useAccount.getState().clearAccount();
}

function subscribeRealtime(userId: string) {
  if (channel) void supabase.removeChannel(channel);
  // `reviews` and `submissions` are in the supabase_realtime publication; RLS limits events to this learner's rows.
  // a fresh topic each time: supabase.channel() hands back an existing (already subscribed) channel by name
  channel = supabase
    .channel(`learner-${userId}-${Date.now()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'reviews' }, () => scheduleRefresh(300))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'submissions' }, () => scheduleRefresh(300))
    .subscribe();
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

/** First launch shows the welcome; existing guest installs and stored sessions skip it. */
async function decideOnboarding(hasSession: boolean) {
  const acct = useAccount.getState();
  if (acct.onboarded !== null) return;
  if (hasSession || !supabaseConfigured) return acct.set({ onboarded: true });
  acct.set({ onboarded: await hadLearnerData });
}

function waitForHydration(): Promise<void> {
  const stores = [useAccount.persist, useOutbox.persist, useLearner.persist];
  return Promise.all(
    stores.map(
      (p) =>
        new Promise<void>((res) => {
          if (p.hasHydrated()) return res();
          const off = p.onFinishHydration(() => {
            off();
            res();
          });
        }),
    ),
  ).then(() => undefined);
}

export function startSync() {
  if (started) return;
  started = true;

  void (async () => {
    await waitForHydration();
    if (!supabaseConfigured) {
      useAccount.getState().set({ status: 'guest' });
      await decideOnboarding(false);
      return;
    }

    let booted = false;
    let lastUserId: string | null = null;
    const handle = (event: AuthChangeEvent, session: Session | null) => {
      setCurrentSession(session);
      const nextId = session?.user.id ?? null;
      if (event === 'INITIAL_SESSION' || !booted) {
        booted = true;
        lastUserId = nextId;
        void decideOnboarding(!!session);
        if (session) void signedIn(session, false);
        else useAccount.getState().set({ status: 'guest' });
        return;
      }
      if (nextId === lastUserId) return; // token refresh, user update
      lastUserId = nextId;
      if (session) void signedIn(session, true);
      else signedOut();
    };
    // supabase-js warns against awaiting other supabase calls inside the callback
    supabase.auth.onAuthStateChange((event, session) => {
      setTimeout(() => handle(event, session), 0);
    });
  })();

  // New practice → outbox; synced-state edits → dirty flag.
  useLearner.subscribe((s, prev) => {
    if (!user) return;
    const uid = user.id;
    if (s.practiceLog !== prev.practiceLog) {
      const known = new Set(prev.practiceLog.map((r) => r.id));
      enqueue(
        s.practiceLog
          .filter((r) => !known.has(r.id) && r.ownerId === uid)
          .map(completionOp)
          .filter((o): o is Op => !!o),
      );
    }
    if (s.sessions !== prev.sessions) {
      const known = new Set(prev.sessions.map((r) => r.id));
      enqueue(s.sessions.filter((r) => !known.has(r.id) && r.ownerId === uid).map(sessionOp));
    }
    if (!applyingRemote && SYNCED_KEYS.some((k) => s[k] !== prev[k])) {
      useOutbox.getState().markStateDirty(uid, true);
      flushSoon();
    }
  });

  AppState.addEventListener('change', (state) => {
    if (state !== 'active' || !user) return;
    resetBackoff(user.id);
    void flush();
    if (Date.now() - lastRefresh > 15_000) void refresh();
  });

  let wasOnline = true;
  try {
    Network.addNetworkStateListener((st) => {
      const online = !!st.isConnected && st.isInternetReachable !== false;
      if (online && !wasOnline) void syncNow();
      wasOnline = online;
    });
  } catch {
    // web without the Network Information API: foreground + backoff still cover it
  }
  onSimulatedOfflineChange((off) => {
    if (!off) void syncNow();
  });
}

// ---------------------------------------------------------------------------
// Learner actions that write to the server
// ---------------------------------------------------------------------------

/**
 * Send one practice session to a cohort's trainer. Queues the session (idempotent if
 * it's already uploaded) and a new submission; the UI shows it as submitted at once.
 * A session that was withdrawn can be shared again: that's a new submission row with
 * a new id (the withdrawn one stays as history). While one is active, a second tap
 * returns it instead of queuing a duplicate.
 */
export function submitForReview(
  target: { sessionId: string; kind: 'roleplay' | 'drill'; refId: string; session?: PracticeSession },
  cohortId: string,
  note: string,
): Submission | null {
  if (!user) return null;
  const active = useAccount.getState().submissions.find((x) => x.sessionId === target.sessionId && x.status !== 'withdrawn');
  if (active) return active;
  const sub: Submission = {
    id: uuid(),
    sessionId: target.sessionId,
    cohortId,
    kind: target.kind,
    refId: target.refId,
    note: note || null,
    status: 'submitted',
    submittedAt: new Date().toISOString(),
    reviewedAt: null,
    local: true,
  };
  useAccount.getState().addLocalSubmission(sub);
  enqueue([
    // a session from another device is already on the server; only this device's copy needs uploading
    ...(target.session ? [sessionOp(target.session)] : []),
    { type: 'submission', row: { id: sub.id, session_id: target.sessionId, cohort_id: cohortId, note_to_trainer: sub.note } },
  ]);
  return sub;
}

/** Take a submission back while it's still waiting for review. */
export function withdrawSubmission(id: string) {
  if (!user) return;
  useAccount.getState().setSubmissionStatus(id, 'withdrawn');
  enqueue([{ type: 'withdraw', submissionId: id }]);
}

/** The learner opened a review. */
export function markReviewSeen(reviewId: string) {
  if (!user) return;
  const r = useAccount.getState().reviews.find((x) => x.id === reviewId);
  if (!r || r.learnerSeenAt) return;
  const at = new Date().toISOString();
  useAccount.getState().markReviewSeen(reviewId, at);
  enqueue([{ type: 'seen', reviewId, at }]);
}

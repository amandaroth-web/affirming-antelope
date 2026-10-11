import type { Json, PathwayId, SkillId } from '@antelope/core';
import { errorCode, supabase } from '@/lib/supabase';
import { useAccount } from '@/state/account';
import { fillSkills, mergeProgress, skillRank, toRemoteDoc, upgradeDoc } from '@/state/learnerDoc';
import { SYNCED_KEYS, syncedState, useLearner, type SyncedState } from '@/state/store';

/**
 * learner_state: one jsonb document per user, versioned.
 *
 * Writes are last-write-wins on the whole document, guarded by `version`: every
 * write sends the version it last saw + 1, and the server rejects anything not
 * newer (PT409). On a conflict the app refetches, merges field by field so no
 * progress is lost on either side (`mergeSynced`), and writes server version + 1.
 */

type Row = { state: Json; version: number };

/** True while a server document is being applied, so the change isn't echoed back as a local edit. */
export let applyingRemote = false;
function apply(next: SyncedState) {
  applyingRemote = true;
  try {
    useLearner.getState().applySynced(next);
  } finally {
    applyingRemote = false;
  }
}

export async function fetchState(userId: string): Promise<Row | null> {
  const { data, error } = await supabase.from('learner_state').select('state, version').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Merge. Every rule is monotonic (progress only moves forward), so merging is
// order-independent: merge(a, b) == merge(b, a) for the fields that matter.
// Documents are upgraded on read (`upgradeDoc`): v2 (one pathway at the top level)
// becomes v3 (progress per pathway), and an untouched v2 demo seed becomes fresh.
// ---------------------------------------------------------------------------

function mergeSkills(a: SyncedState['skills'], b: Partial<SyncedState['skills']> | undefined): SyncedState['skills'] {
  if (!b) return a;
  const out = { ...a };
  for (const k of Object.keys(b) as SkillId[]) {
    const theirs = b[k];
    if (!theirs) continue;
    const mine = out[k];
    out[k] = !mine || skillRank(theirs) > skillRank(mine) ? theirs : mine;
  }
  return out;
}

function mergeStreak(a: SyncedState['streak'], b: SyncedState['streak'] | undefined): SyncedState['streak'] {
  if (!b) return a;
  const da = a.lastPracticeDay ?? '';
  const db = b.lastPracticeDay ?? '';
  if (da === db) return a.days >= b.days ? a : b;
  return da > db ? a : b;
}

function mergeAllProgress(a: SyncedState['progress'], b: SyncedState['progress']): SyncedState['progress'] {
  const out: SyncedState['progress'] = {};
  for (const id of new Set([...Object.keys(a), ...Object.keys(b)]) as Set<PathwayId>) out[id] = mergeProgress(a[id], b[id]);
  return out;
}

/** The track picked most recently wins (a pick beats no pick); ties go to the account's copy. */
function laterChoice(local: SyncedState, remote: SyncedState): Pick<SyncedState, 'activePathwayId' | 'pathwayChosenAt'> {
  const l = local.pathwayChosenAt ?? '';
  const r = remote.pathwayChosenAt ?? '';
  const pick = l > r ? local : remote;
  return { activePathwayId: pick.activePathwayId, pathwayChosenAt: pick.pathwayChosenAt };
}

/** Fill gaps in a server document (older app versions, the seed) from local defaults. */
export function normalizeSynced(remote: unknown, fallback: SyncedState): SyncedState {
  const r = upgradeDoc(remote);
  const out = { ...fallback } as Record<string, unknown>;
  for (const k of SYNCED_KEYS) if (r[k] !== undefined) out[k] = r[k];
  const s = out as SyncedState;
  s.skills = fillSkills(fallback.skills, r.skills);
  return s;
}

export function mergeSynced(local: SyncedState, remoteRaw: unknown): SyncedState {
  const remote = normalizeSynced(remoteRaw, local);
  const weekDays = Array.from({ length: 7 }, (_, i) => !!local.weekDays[i] || !!remote.weekDays[i]);
  return {
    // identity: the account's copy wins (it's what the learner set up)
    firstName: remote.firstName || local.firstName,
    role: remote.role || local.role,
    ...laterChoice(local, remote),
    progress: mergeAllProgress(local.progress, remote.progress),
    skills: mergeSkills(local.skills, remote.skills),
    streak: mergeStreak(local.streak, remote.streak),
    weekDays,
    weeklyGoal: {
      target: remote.weeklyGoal.target || local.weeklyGoal.target,
      done: Math.max(local.weeklyGoal.done, remote.weeklyGoal.done),
      hitCount: Math.max(local.weeklyGoal.hitCount, remote.weeklyGoal.hitCount),
    },
    scenariosCompleted: Math.max(local.scenariosCompleted, remote.scenariosCompleted),
  };
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

// ---------------------------------------------------------------------------
// Push / pull
// ---------------------------------------------------------------------------

/**
 * Write the local document as version (last seen + 1). On PT409, refetch, merge,
 * apply locally and retry (bounded). Throws on network errors (the caller retries).
 */
export async function pushState(userId: string): Promise<void> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const state = syncedState(useLearner.getState());
    const version = useAccount.getState().stateVersion + 1;
    const { data, error } = await supabase
      .from('learner_state')
      .upsert(
        {
          user_id: userId,
          state: toRemoteDoc(state) as unknown as NonNullable<Json>,
          version,
        },
        { onConflict: 'user_id' },
      )
      .select('version')
      .single();
    if (!error) {
      useAccount.getState().set({ stateVersion: data.version });
      return;
    }
    if (errorCode(error) !== 'PT409') throw error;
    // someone else (another device) wrote first: take theirs into account and go again
    const server = await fetchState(userId);
    if (server) {
      apply(mergeSynced(syncedState(useLearner.getState()), server.state));
      useAccount.getState().set({ stateVersion: server.version });
    }
  }
  throw new Error('learner_state: kept conflicting');
}

/**
 * Bring in the server's document if it's newer than what this device last saw.
 * Returns true when the merged result differs from the server's (so it needs a push).
 */
export async function pullState(userId: string): Promise<boolean> {
  const server = await fetchState(userId);
  if (!server) return true; // nothing there yet: ours becomes the first version
  const { stateVersion } = useAccount.getState();
  // older than what we've seen: the server was reset (or restored); take it as new, don't skip it
  if (server.version === stateVersion) return false;
  const local = syncedState(useLearner.getState());
  const merged = mergeSynced(local, server.state);
  apply(merged);
  useAccount.getState().set({ stateVersion: server.version });
  return !same(merged, normalizeSynced(server.state, merged));
}

function adopt(local: SyncedState, remote: SyncedState): SyncedState {
  const choice = laterChoice(local, remote);
  const progress = { ...remote.progress };
  if (!progress[choice.activePathwayId] && local.progress[choice.activePathwayId]) progress[choice.activePathwayId] = local.progress[choice.activePathwayId];
  return { ...remote, ...choice, progress };
}

/**
 * Sign-in. If this device has no guest practice of its own (a fresh install, or
 * one that already belonged to another account), the account's saved progress
 * simply replaces the local demo state. Otherwise the two are merged so the
 * guest's work carries over. Returns true when the result needs a push.
 */
export async function adoptOnSignIn(userId: string, hasGuestWork: boolean): Promise<boolean> {
  const server = await fetchState(userId);
  if (!server) {
    useAccount.getState().set({ stateVersion: 0 });
    return true;
  }
  const local = syncedState(useLearner.getState());
  // no guest practice: the account's progress replaces the device's fresh start, but a track
  // picked on this device after the account's last pick still counts
  const next = hasGuestWork ? mergeSynced(local, server.state) : adopt(local, normalizeSynced(server.state, local));
  apply(next);
  useAccount.getState().set({ stateVersion: server.version });
  return !same(next, normalizeSynced(server.state, next));
}

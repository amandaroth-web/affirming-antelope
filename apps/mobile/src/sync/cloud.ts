import type { SkillId } from '@antelope/core';
import { errorCode, isTransient, supabase } from '@/lib/supabase';
import {
  useAccount,
  type Assignment,
  type AssignmentItemKind,
  type Cohort,
  type Profile,
  type RatingLevel,
  type Review,
  type Submission,
  type SubmissionStatus,
} from '@/state/account';
import { useOutbox } from './outbox';

/**
 * Server-owned data (profile, cohorts, assignments, submissions, reviews), fetched
 * into the account cache. Reads only; writes go through the outbox or the direct
 * actions below (join / leave / rename), which need an answer right away.
 */

const FALLBACK_TRAINER = 'Your trainer';

async function fetchProfile(userId: string, email: string): Promise<Profile> {
  const { data, error } = await supabase.from('profiles').select('id, display_name, display_name_set, can_train').eq('id', userId).single();
  if (error) throw error;
  return {
    id: data.id,
    email,
    displayName: data.display_name,
    needsName: !data.display_name_set,
    canTrain: !!data.can_train,
  };
}

async function fetchCohorts(userId: string): Promise<Cohort[]> {
  const { data, error } = await supabase
    .from('cohort_members')
    .select('role, joined_at, cohort:cohorts(id, name, join_code, trainer_id, archived_at)')
    .eq('user_id', userId)
    .eq('role', 'learner');
  if (error) throw error;
  const rows = (data ?? []).filter((r) => r.cohort && !r.cohort.archived_at);
  const names = await trainerNames(rows.map((r) => r.cohort!.trainer_id));
  return rows
    .map((r) => ({
      id: r.cohort!.id,
      name: r.cohort!.name,
      joinCode: r.cohort!.join_code,
      trainerId: r.cohort!.trainer_id,
      trainerName: names.get(r.cohort!.trainer_id) ?? FALLBACK_TRAINER,
      joinedAt: r.joined_at,
    }))
    .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt));
}

async function trainerNames(ids: string[]): Promise<Map<string, string>> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (!unique.length) return new Map();
  const { data, error } = await supabase.from('profiles').select('id, display_name').in('id', unique);
  if (error) throw error;
  return new Map((data ?? []).map((p) => [p.id, p.display_name]));
}

async function fetchAssignments(cohortIds: string[]): Promise<Assignment[]> {
  if (!cohortIds.length) return [];
  const { data, error } = await supabase
    .from('assignments')
    .select('id, cohort_id, title, instructions, due_at, created_at, items:assignment_items(id, kind, ref_id, skill, quantity, position)')
    .in('cohort_id', cohortIds)
    .is('archived_at', null)
    .order('due_at', { ascending: true, nullsFirst: false });
  if (error) throw error;
  const list = data ?? [];
  // one progress call per assignment (learners only see their own rows)
  const progress = await Promise.all(
    list.map(async (a) => {
      const { data: rows, error: e } = await supabase.rpc('assignment_progress', { assignment_id: a.id });
      if (e) throw e;
      return new Map((rows ?? []).map((r) => [r.item_id, r.done]));
    }),
  );
  return list.map((a, i) => ({
    id: a.id,
    cohortId: a.cohort_id,
    title: a.title,
    instructions: a.instructions,
    dueAt: a.due_at,
    createdAt: a.created_at,
    items: (a.items ?? [])
      .map((it) => ({
        id: it.id,
        kind: it.kind as AssignmentItemKind,
        refId: it.ref_id,
        skill: (it.skill as SkillId | null) ?? null,
        quantity: it.quantity,
        position: it.position,
        done: progress[i].get(it.id) ?? 0,
      }))
      .sort((x, y) => x.position - y.position),
  }));
}

async function fetchSubmissions(userId: string): Promise<{ submissions: Submission[]; reviews: Review[] }> {
  const { data, error } = await supabase
    .from('submissions')
    .select(
      'id, session_id, cohort_id, note_to_trainer, status, submitted_at, reviewed_at, session:practice_sessions(kind, ref_id), review:reviews(id, trainer_id, feedback, audio_path, rating, recommended_kind, recommended_ref, try_again, created_at, updated_at, learner_seen_at)',
    )
    .eq('user_id', userId)
    .order('submitted_at', { ascending: false });
  if (error) throw error;
  const rows = data ?? [];
  const reviewRows = rows.flatMap((r) => {
    const rv = Array.isArray(r.review) ? r.review[0] : r.review;
    return rv ? [{ ...rv, submission_id: r.id }] : [];
  });
  const names = await trainerNames(reviewRows.map((r) => r.trainer_id));
  const submissions: Submission[] = rows.map((r) => ({
    id: r.id,
    sessionId: r.session_id,
    cohortId: r.cohort_id,
    kind: (r.session?.kind as 'roleplay' | 'drill') ?? 'roleplay',
    refId: r.session?.ref_id ?? '',
    note: r.note_to_trainer,
    status: r.status as SubmissionStatus,
    submittedAt: r.submitted_at,
    reviewedAt: r.reviewed_at,
  }));
  const reviews: Review[] = reviewRows.map((r) => ({
    id: r.id,
    submissionId: r.submission_id,
    trainerId: r.trainer_id,
    trainerName: names.get(r.trainer_id) ?? FALLBACK_TRAINER,
    feedback: r.feedback,
    audioPath: r.audio_path,
    rating: (r.rating as RatingLevel | null) ?? null,
    recommendedKind: (r.recommended_kind as Review['recommendedKind']) ?? null,
    recommendedRef: r.recommended_ref,
    tryAgain: r.try_again,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    learnerSeenAt: r.learner_seen_at,
  }));
  return { submissions, reviews };
}

/** Keep optimistic local changes that the server hasn't caught up with yet. */
function reconcile(userId: string, server: { submissions: Submission[]; reviews: Review[] }) {
  const prev = useAccount.getState();
  const queued = useOutbox.getState().entries.filter((e) => e.userId === userId);
  const queuedSubs = new Set(queued.flatMap((e) => (e.op.type === 'submission' ? [e.op.row.id] : [])));
  const queuedWithdraw = new Set(queued.flatMap((e) => (e.op.type === 'withdraw' ? [e.op.submissionId] : [])));
  const queuedSeen = new Map(queued.flatMap((e) => (e.op.type === 'seen' ? [[e.op.reviewId, e.op.at] as const] : [])));
  const onServer = new Set(server.submissions.map((s) => s.id));
  const submissions = [
    ...prev.submissions.filter((s) => s.local && queuedSubs.has(s.id) && !onServer.has(s.id)),
    ...server.submissions.map((s) => (queuedWithdraw.has(s.id) && s.status === 'submitted' ? { ...s, status: 'withdrawn' as const } : s)),
  ];
  const reviews = server.reviews.map((r) => (!r.learnerSeenAt && queuedSeen.has(r.id) ? { ...r, learnerSeenAt: queuedSeen.get(r.id)! } : r));
  return { submissions, reviews };
}

/**
 * Refresh everything for the signed-in user. Network failures leave the cache in
 * place and set `offline`; returns false then.
 */
export async function refreshCloud(userId: string, email: string): Promise<boolean> {
  const acct = useAccount.getState();
  acct.set({ refreshing: true });
  try {
    const [profile, cohorts, subs] = await Promise.all([fetchProfile(userId, email), fetchCohorts(userId), fetchSubmissions(userId)]);
    const assignments = await fetchAssignments(cohorts.map((c) => c.id));
    // the user may have signed out while this was in flight
    if (useAccount.getState().profile && useAccount.getState().profile?.id !== userId) return false;
    useAccount.getState().set({
      profile,
      cohorts,
      assignments,
      ...reconcile(userId, subs),
      lastRefreshAt: new Date().toISOString(),
      offline: false,
    });
    return true;
  } catch (e) {
    if (isTransient(e)) useAccount.getState().set({ offline: true });
    else console.warn('[cloud] refresh failed', errorCode(e), (e as Error)?.message);
    return false;
  } finally {
    useAccount.getState().set({ refreshing: false });
  }
}

// ---------------------------------------------------------------------------
// Direct actions (need an immediate answer, so they don't queue)
// ---------------------------------------------------------------------------

export type JoinResult = { ok: true; cohort: { id: string; name: string } } | { ok: false; reason: 'not-found' | 'offline' | 'error' };

/** "mil demo", "MIL-DEMO", "demo" → "MIL-DEMO". */
export function normalizeJoinCode(raw: string): string {
  const s = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const tail = s.startsWith('MIL') && s.length > 4 ? s.slice(3) : s;
  return `MIL-${tail.slice(0, 4)}`;
}

export async function joinCohort(code: string): Promise<JoinResult> {
  const { data, error } = await supabase.rpc('join_cohort', {
    code: normalizeJoinCode(code),
  });
  if (error) {
    if (errorCode(error) === 'PT404') return { ok: false, reason: 'not-found' };
    return { ok: false, reason: isTransient(error) ? 'offline' : 'error' };
  }
  return { ok: true, cohort: { id: data.id, name: data.name } };
}

export async function leaveCohort(userId: string, cohortId: string): Promise<boolean> {
  const { error } = await supabase.from('cohort_members').delete().eq('cohort_id', cohortId).eq('user_id', userId);
  if (error) return false;
  const s = useAccount.getState();
  s.set({
    cohorts: s.cohorts.filter((c) => c.id !== cohortId),
    assignments: s.assignments.filter((a) => a.cohortId !== cohortId),
  });
  return true;
}

export async function renameSelf(userId: string, displayName: string): Promise<boolean> {
  const name = displayName.trim().slice(0, 80);
  if (!name) return false;
  const { error } = await supabase.from('profiles').update({ display_name: name }).eq('id', userId);
  if (error) return false;
  const p = useAccount.getState().profile;
  if (p) useAccount.getState().set({ profile: { ...p, displayName: name, needsName: false } });
  return true;
}

/** A short-lived URL for the trainer's voice note (private bucket). */
export async function reviewAudioUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from('review-audio').createSignedUrl(path, 60 * 60);
  if (error) return null;
  return data.signedUrl;
}

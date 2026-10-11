import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SkillId } from '@antelope/core';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * Account + cohort data from Supabase, cached on the device so Home and Me render
 * offline and on cold start before the first refresh. The server is the source of
 * truth for everything here; `sync/cloud.ts` refreshes it. Learner practice state
 * lives in `store.ts` (the device is the source of truth for that).
 */

export type AuthStatus = 'loading' | 'guest' | 'signed-in';

export interface Profile {
  id: string;
  email: string;
  displayName: string;
  /** True when display_name is still the trigger's default (the email's local part). */
  needsName: boolean;
  /** profiles.can_train. Analytics only (person property); absent in older caches. */
  canTrain?: boolean;
}

export interface Cohort {
  id: string;
  name: string;
  joinCode: string;
  trainerId: string;
  /** "Dr. Rosa Lin"; "Your trainer" when the profile isn't readable. */
  trainerName: string;
  joinedAt: string;
}

export type AssignmentItemKind = 'drill' | 'roleplay' | 'learn' | 'any-drill' | 'any-roleplay';

export interface AssignmentItem {
  id: string;
  kind: AssignmentItemKind;
  refId: string | null;
  skill: SkillId | null;
  quantity: number;
  position: number;
  /** From assignment_progress (capped at quantity). */
  done: number;
}

export interface Assignment {
  id: string;
  cohortId: string;
  title: string;
  instructions: string;
  dueAt: string | null;
  createdAt: string;
  items: AssignmentItem[];
}

export type SubmissionStatus = 'submitted' | 'reviewed' | 'withdrawn';

export interface Submission {
  id: string;
  sessionId: string;
  cohortId: string;
  kind: 'roleplay' | 'drill';
  refId: string;
  note: string | null;
  status: SubmissionStatus;
  submittedAt: string;
  reviewedAt: string | null;
  /** Created on this device and not on the server yet (still in the outbox). */
  local?: boolean;
}

export type RatingLevel = 'emerging' | 'developing' | 'proficient' | 'strong';

export interface Review {
  id: string;
  submissionId: string;
  trainerId: string;
  trainerName: string;
  feedback: string;
  audioPath: string | null;
  rating: RatingLevel | null;
  recommendedKind: 'learn' | 'drill' | 'roleplay' | null;
  recommendedRef: string | null;
  tryAgain: boolean;
  createdAt: string;
  updatedAt: string;
  learnerSeenAt: string | null;
}

export interface AccountState {
  /** null until the first-launch probe runs; false shows the welcome. */
  onboarded: boolean | null;
  status: AuthStatus;
  profile: Profile | null;
  cohorts: Cohort[];
  assignments: Assignment[];
  submissions: Submission[];
  reviews: Review[];
  /** The `learner_state.version` this device last saw for the signed-in user. */
  stateVersion: number;
  lastRefreshAt: string | null;
  refreshing: boolean;
  /** The last refresh failed on the network (cached data is showing). */
  offline: boolean;
}

export interface AccountActions {
  set: (patch: Partial<AccountState>) => void;
  /** Sign-out: forget everything account-specific; practice data stays in the learner store. */
  clearAccount: () => void;
  addLocalSubmission: (s: Submission) => void;
  setSubmissionStatus: (id: string, status: SubmissionStatus) => void;
  markReviewSeen: (id: string, at: string) => void;
}

const EMPTY: Pick<AccountState, 'profile' | 'cohorts' | 'assignments' | 'submissions' | 'reviews' | 'stateVersion' | 'lastRefreshAt' | 'offline'> = {
  profile: null,
  cohorts: [],
  assignments: [],
  submissions: [],
  reviews: [],
  stateVersion: 0,
  lastRefreshAt: null,
  offline: false,
};

export const useAccount = create<AccountState & AccountActions>()(
  persist(
    (set) => ({
      onboarded: null,
      status: 'loading',
      refreshing: false,
      ...EMPTY,
      set: (patch) => set(patch),
      clearAccount: () => set({ ...EMPTY, status: 'guest' }),
      addLocalSubmission: (sub) =>
        set((s) => ({
          submissions: [sub, ...s.submissions.filter((x) => x.id !== sub.id)],
        })),
      setSubmissionStatus: (id, status) =>
        set((s) => ({
          submissions: s.submissions.map((x) => (x.id === id ? { ...x, status } : x)),
        })),
      markReviewSeen: (id, at) =>
        set((s) => ({
          reviews: s.reviews.map((r) => (r.id === id && !r.learnerSeenAt ? { ...r, learnerSeenAt: at } : r)),
        })),
    }),
    {
      name: 'antelope.account.v1',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      // status is decided at launch from the stored auth session; refreshing never persists
      partialize: ({ status: _s, refreshing: _r, set: _a, clearAccount: _c, addLocalSubmission: _l, setSubmissionStatus: _t, markReviewSeen: _m, ...rest }) =>
        rest,
    },
  ),
);

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

export const useSignedIn = () => useAccount((s) => s.status === 'signed-in');

/** First word of the display name, for greetings. */
export function firstNameOf(displayName: string | undefined | null): string | undefined {
  const n = displayName?.trim();
  if (!n) return undefined;
  const parts = n.split(/\s+/);
  // "Dr. Rosa Lin" greets as Rosa
  return /^(dr|mr|mrs|ms|mx|prof)\.?$/i.test(parts[0]) && parts[1] ? parts[1] : parts[0];
}

/**
 * Avatar seed for a person known by name. The demo trainer keeps the face guests
 * already know from the demo assignment, so signing in doesn't change who she is.
 */
export function personSeed(name: string): string {
  return name.trim() === 'Dr. Rosa Lin' ? 'rosa-lin-trainer' : `person:${name.trim().toLowerCase()}`;
}

/** Reviews the learner hasn't opened yet, newest first. */
export function unseenReviews(reviews: Review[]): Review[] {
  return reviews.filter((r) => !r.learnerSeenAt).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** The plain-language rating. Never a number. */
export const RATING: Record<RatingLevel, { label: string; detail: string }> = {
  emerging: {
    label: 'Emerging',
    detail: 'The skill is starting to show. Keep the reps coming.',
  },
  developing: {
    label: 'Developing',
    detail: 'It’s there in places. The next step is doing it on purpose.',
  },
  proficient: {
    label: 'Proficient',
    detail: 'You’re doing this reliably in a real conversation.',
  },
  strong: {
    label: 'Strong',
    detail: 'Skilled and natural. This is one to model for others.',
  },
};

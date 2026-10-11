-- A learner may re-submit a session they withdrew. Only one non-withdrawn
-- submission per session is allowed; withdrawn ones stay as history and remain
-- hidden from trainers.
alter table public.submissions drop constraint submissions_session_id_key;
create unique index submissions_one_active_per_session
  on public.submissions (session_id) where status <> 'withdrawn';

-- Live updates for the learner's "From your trainer" inbox and submission
-- status. Realtime postgres_changes respects RLS, so learners only receive
-- their own rows and trainers only rows in cohorts they train.
alter publication supabase_realtime add table public.reviews, public.submissions;

-- Learners can read the profile of the trainer(s) of cohorts they belong to, so
-- the app can show "Dr. Rosa Lin" on assignments and reviews. Fellow learners'
-- profiles stay private.

create function app_private.my_trainer_ids()
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select c.trainer_id from public.cohorts c
   where c.id in (select app_private.member_cohort_ids())
  union
  select m.user_id from public.cohort_members m
   where m.role = 'trainer'
     and m.cohort_id in (select app_private.member_cohort_ids())
$$;

revoke execute on function app_private.my_trainer_ids() from public, anon;
grant execute on function app_private.my_trainer_ids() to authenticated;

create policy "profiles: members read their cohort trainers"
  on public.profiles for select to authenticated
  using (id in (select app_private.my_trainer_ids()));

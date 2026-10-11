-- Cohorts run a specific pathway (MI for Leaders or MI for Clinicians). Keep the
-- column honest with a check, and let trainers choose it when creating a cohort.
alter table public.cohorts
  add constraint cohorts_pathway_id_check check (pathway_id in ('mi-for-leaders', 'mi-for-clinicians'));

drop function public.create_cohort(text, date);

create function public.create_cohort(name text, starts_on date default null, pathway_id text default 'mi-for-leaders')
returns public.cohorts
language plpgsql volatile security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  created public.cohorts;
begin
  if uid is null then
    raise exception 'Sign in to create a cohort' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles p where p.id = uid and p.can_train) then
    raise exception 'Only trainers can create cohorts' using errcode = '42501';
  end if;

  insert into public.cohorts (name, trainer_id, join_code, starts_on, pathway_id)
  values (btrim(create_cohort.name), uid, app_private.generate_join_code(), create_cohort.starts_on,
          coalesce(create_cohort.pathway_id, 'mi-for-leaders'))
  returning * into created;

  insert into public.cohort_members (cohort_id, user_id, role)
  values (created.id, uid, 'trainer')
  on conflict (cohort_id, user_id) do update set role = 'trainer';

  return created;
end;
$$;

revoke execute on function public.create_cohort(text, date, text) from public, anon;
grant execute on function public.create_cohort(text, date, text) to authenticated;

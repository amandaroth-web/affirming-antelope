-- Storage: trainer audio feedback on a submission.
-- Path: {cohort_id}/{submission_id}/{uuid}.m4a|webm
-- The cohort trainer uploads/reads/replaces/deletes; the submitting learner reads.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'review-audio',
  'review-audio',
  false,
  26214400, -- 25 MB
  array['audio/mp4', 'audio/m4a', 'audio/x-m4a', 'audio/aac', 'audio/webm', 'video/webm']
)
on conflict (id) do nothing;

create function app_private.can_access_review_audio(object_name text, for_write boolean)
returns boolean
language plpgsql stable security definer set search_path = ''
as $$
declare
  uuid_re constant text := '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
  parts text[] := string_to_array(object_name, '/');
  sub record;
begin
  if auth.uid() is null
     or coalesce(array_length(parts, 1), 0) <> 3
     or parts[1] !~ ('^' || uuid_re || '$')
     or parts[2] !~ ('^' || uuid_re || '$')
     or parts[3] !~ ('^' || uuid_re || '\.(m4a|webm)$') then
    return false;
  end if;

  select s.user_id, s.status into sub
    from public.submissions s
   where s.id = parts[2]::uuid
     and s.cohort_id = parts[1]::uuid;
  if not found then
    return false;
  end if;

  if sub.status <> 'withdrawn' and parts[1]::uuid in (select app_private.trained_cohort_ids()) then
    return true;
  end if;

  return not for_write and sub.user_id = auth.uid();
end;
$$;

revoke execute on function app_private.can_access_review_audio(text, boolean) from public, anon;
grant execute on function app_private.can_access_review_audio(text, boolean) to authenticated, service_role;

create policy "review-audio: trainer and submitting learner read"
  on storage.objects for select to authenticated
  using (bucket_id = 'review-audio' and app_private.can_access_review_audio(name, false));

create policy "review-audio: cohort trainer uploads"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'review-audio' and app_private.can_access_review_audio(name, true));

create policy "review-audio: cohort trainer replaces"
  on storage.objects for update to authenticated
  using (bucket_id = 'review-audio' and app_private.can_access_review_audio(name, true))
  with check (bucket_id = 'review-audio' and app_private.can_access_review_audio(name, true));

create policy "review-audio: cohort trainer deletes"
  on storage.objects for delete to authenticated
  using (bucket_id = 'review-audio' and app_private.can_access_review_audio(name, true));

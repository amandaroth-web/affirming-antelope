-- Whether the person chose their display name. Sign-up defaults it to the
-- email's local part, so the app asks for a name until this is true.
alter table public.profiles add column display_name_set boolean not null default false;

create function app_private.mark_display_name_set()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.display_name is distinct from old.display_name then
    new.display_name_set := true;
  end if;
  return new;
end $$;

create trigger profiles_mark_display_name_set
  before update of display_name on public.profiles
  for each row execute function app_private.mark_display_name_set();

-- Existing people have already been through sign-up.
update public.profiles set display_name_set = true;

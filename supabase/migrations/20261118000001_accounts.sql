-- Accounts and profiles: usernames chosen at sign-up, reserved names, avatar
-- storage, public profile counts, and database-enforced rate limits.

-- ---------------------------------------------------------------------------
-- Rate limits. Fixed windows per (bucket, user). Enforced inside the database
-- by triggers, so they hold for the Data API as well as the app's routes.
-- A rejected attempt rolls back its own increment, so the counter stays at the
-- limit until the window ends.
-- ---------------------------------------------------------------------------
create table private.rate_limit_hits (
  bucket text not null,
  subject uuid not null,
  window_start timestamptz not null,
  hits integer not null default 1,
  primary key (bucket, subject, window_start)
);
comment on table private.rate_limit_hits is 'Counters for private.rate_limit(). Rows older than two days are deleted nightly.';

create function private.rate_limit(p_bucket text, p_max integer, p_window interval) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  secs double precision := extract(epoch from p_window);
  ws timestamptz;
  n integer;
begin
  -- Service role, jobs and moderators are not limited.
  if uid is null or private.is_moderator() then
    return;
  end if;
  ws := to_timestamp(floor(extract(epoch from now()) / secs) * secs);
  insert into private.rate_limit_hits as r (bucket, subject, window_start)
  values (p_bucket, uid, ws)
  on conflict (bucket, subject, window_start) do update set hits = r.hits + 1
  returning r.hits into n;
  if n > p_max then
    raise exception 'rate limit exceeded: %', p_bucket
      using errcode = 'RL429',
            hint = 'retry after ' || to_char(ws + p_window, 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
  end if;
end;
$$;

select cron.schedule(
  'prune-rate-limits',
  '45 3 * * *',
  $$ delete from private.rate_limit_hits where window_start < now() - interval '2 days'; $$
);

-- ---------------------------------------------------------------------------
-- Handles: reserved names and the pattern used for placeholder handles.
-- Keep in sync with RESERVED_HANDLES in lib/validation/profile.ts.
-- ---------------------------------------------------------------------------
create function private.handle_reserved(h text) returns boolean
language sql immutable set search_path = '' as $$
  select h ~ '^user_[0-9a-f]{12}$'
      or h = any (array[
        'admin', 'administrator', 'api', 'auth', 'help', 'ismymediaai', 'me', 'mod', 'moderator',
        'moderators', 'null', 'root', 'settings', 'sign_in', 'sign_out', 'sign_up', 'signin',
        'signout', 'signup', 'staff', 'support', 'system', 'team', 'undefined'
      ]);
$$;

-- Anyone may ask whether a username is free (profiles are public anyway).
create function public.handle_available(p_handle text) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_handle ~ '^[a-z0-9_]{3,30}$'
     and not private.handle_reserved(p_handle)
     and not exists (select 1 from public.profiles where handle = p_handle);
$$;

-- New users keep the username they picked at sign-up when it is valid and
-- free; otherwise (OAuth, or a race) they get a placeholder to change later.
create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  wanted text := lower(btrim(coalesce(new.raw_user_meta_data ->> 'handle', '')));
  placeholder text := 'user_' || substr(replace(new.id::text, '-', ''), 1, 12);
  dname text := nullif(btrim(coalesce(
    new.raw_user_meta_data ->> 'display_name',
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    ''
  )), '');
begin
  dname := left(regexp_replace(dname, '[[:cntrl:]]', '', 'g'), 50);
  if dname = '' then
    dname := null;
  end if;
  if public.handle_available(wanted) then
    begin
      insert into public.profiles (id, handle, display_name) values (new.id, wanted, dname);
      return new;
    exception when unique_violation then
      -- Someone took it a moment ago; fall through to the placeholder.
    end;
  end if;
  insert into public.profiles (id, handle, display_name) values (new.id, placeholder, dname);
  return new;
end;
$$;

-- Profile edits by users: 30-day handle rule (unchanged), no reserved
-- handles, avatar paths only inside the user's own folder, and 10 edits an
-- hour.
create or replace function private.guard_profile_update() returns trigger
language plpgsql as $$
begin
  if auth.uid() is null then
    return new; -- service role, jobs, migrations
  end if;
  if new.handle is distinct from old.handle then
    if old.handle_changed_at is not null
       and old.handle_changed_at > now() - interval '30 days'
       and not private.is_moderator() then
      raise exception 'handle can be changed once every 30 days'
        using errcode = 'check_violation';
    end if;
    if private.handle_reserved(new.handle) and not private.is_moderator() then
      raise exception 'that username is reserved' using errcode = 'check_violation';
    end if;
    new.handle_changed_at := now();
  end if;
  if new.avatar_path is distinct from old.avatar_path and new.avatar_path is not null
     and new.avatar_path !~ ('^' || new.id::text || '/[A-Za-z0-9_-]{1,64}\.(webp|png|jpg)$') then
    raise exception 'avatar must be in your own folder' using errcode = 'check_violation';
  end if;
  if new.display_name is distinct from old.display_name and new.display_name ~ '[[:cntrl:]]' then
    raise exception 'display name has control characters' using errcode = 'check_violation';
  end if;
  if (new.handle, new.display_name, new.avatar_path, new.show_votes)
     is distinct from (old.handle, old.display_name, old.avatar_path, old.show_votes) then
    perform private.rate_limit('profile_update', 10, interval '1 hour');
  end if;
  return new;
end;
$$;

-- my_profile() gains handle_changed_at so settings can say when the next
-- username change is allowed. Same columns plus one, so older app builds work.
drop function public.my_profile();
create function public.my_profile()
returns table (
  id uuid, handle text, display_name text, avatar_path text, role public.user_role,
  trust_level smallint, show_votes boolean, banned_until timestamptz,
  email_verified boolean, created_at timestamptz, handle_changed_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select p.id, p.handle, p.display_name, p.avatar_path, p.role, p.trust_level,
         p.show_votes, p.banned_until, (u.email_confirmed_at is not null), p.created_at,
         p.handle_changed_at
  from public.profiles p join auth.users u on u.id = p.id
  where p.id = auth.uid();
$$;
revoke all on function public.my_profile() from public, anon;
grant execute on function public.my_profile() to authenticated;

-- Public counts for a profile page. Vote counts are public; which titles and
-- how someone voted stay private unless show_votes is on.
create function public.profile_stats(p_user uuid)
returns table (comment_count integer, vote_count integer, titles_added integer)
language sql stable security definer set search_path = '' as $$
  select
    (select count(*)::int from public.comments c
       join public.media m on m.id = c.media_id
      where c.user_id = p_user and c.status = 'published' and c.deleted_at is null
        and m.status = 'published'),
    (select count(*)::int from public.votes v where v.user_id = p_user),
    (select count(*)::int from public.media m where m.created_by = p_user and m.status = 'published');
$$;

revoke all on function public.handle_available(text), public.profile_stats(uuid) from public;
grant execute on function public.handle_available(text), public.profile_stats(uuid) to anon, authenticated, service_role;
revoke all on function private.rate_limit(text, integer, interval), private.handle_reserved(text) from public;
grant execute on function private.rate_limit(text, integer, interval), private.handle_reserved(text)
  to anon, authenticated, service_role;
grant all on private.rate_limit_hits to service_role;

-- ---------------------------------------------------------------------------
-- Avatars: a public bucket, images up to 2 MB, each user writes only inside
-- their own folder and keeps at most 3 files there.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/webp', 'image/png', 'image/jpeg'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create function private.avatar_file_count() returns integer
language sql stable security definer set search_path = '' as $$
  select count(*)::int from storage.objects o
  where o.bucket_id = 'avatars' and (storage.foldername(o.name))[1] = auth.uid()::text;
$$;
revoke all on function private.avatar_file_count() from public;
grant execute on function private.avatar_file_count() to authenticated, service_role;

create policy avatars_select_own on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy avatars_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
    and private.avatar_file_count() < 3
  );
create policy avatars_delete_own on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid()::text));

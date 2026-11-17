-- isMyMediaAI initial schema: enums, tables, constraints and triggers.
-- Row Level Security policies and grants live in the next migration.
-- Migrations are forward-only and follow expand-then-contract (see docs/DATABASE.md).

create schema if not exists private;
comment on schema private is 'Helper functions used by RLS policies and triggers. Not exposed through the Data API.';

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.media_kind as enum ('movie', 'tv_show', 'book');
create type public.credit_role as enum (
  'actor', 'director', 'creator', 'writer', 'showrunner', 'composer',
  'author', 'illustrator', 'translator', 'studio', 'network', 'publisher'
);
create type public.vote_value as enum ('uses_ai', 'no_ai', 'unsure');
create type public.ai_area as enum (
  'writing', 'visuals', 'cover_art', 'voice', 'music', 'translation', 'marketing', 'other'
);
create type public.content_status as enum ('published', 'pending', 'hidden', 'removed');
create type public.user_role as enum ('user', 'moderator', 'admin');
create type public.media_source as enum ('tmdb', 'openlibrary', 'manual');
create type public.contributor_kind as enum ('person', 'company');
create type public.report_target as enum ('media', 'comment', 'profile');
create type public.report_reason as enum (
  'spam', 'harassment', 'unsupported_claim', 'duplicate', 'wrong_details', 'other'
);
create type public.report_status as enum ('open', 'actioned', 'dismissed');
create type public.mod_action_type as enum (
  'hide', 'restore', 'remove', 'ban', 'unban', 'set_trust', 'set_role',
  'merge', 'edit', 'lock_comments', 'dismiss_report'
);

-- ---------------------------------------------------------------------------
-- Shared trigger: updated_at
-- ---------------------------------------------------------------------------
create function private.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  handle text not null unique
    check (handle ~ '^[a-z0-9_]{3,30}$'),
  display_name text
    check (display_name is null or char_length(display_name) between 1 and 50),
  avatar_path text
    check (avatar_path is null or char_length(avatar_path) <= 300),
  role public.user_role not null default 'user',
  trust_level smallint not null default 0 check (trust_level between 0 and 2),
  show_votes boolean not null default false,
  banned_until timestamptz,
  handle_changed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.profiles is 'One row per auth user, created by trigger on sign-up.';

create trigger profiles_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Helpers used by policies. SECURITY DEFINER so they can read profiles and
-- auth.users regardless of the caller's own grants; search_path is pinned.
-- ---------------------------------------------------------------------------
create function private.is_moderator() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('moderator', 'admin')
  );
$$;

create function private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

-- Verified = email confirmed and not currently banned.
create function private.is_verified() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from auth.users u
    join public.profiles p on p.id = u.id
    where u.id = auth.uid()
      and u.email_confirmed_at is not null
      and (p.banned_until is null or p.banned_until <= now())
  );
$$;

create function private.trust_level() returns smallint
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select p.trust_level from public.profiles p where p.id = auth.uid()),
    0::smallint
  );
$$;

-- Create a profile for every new auth user, with a placeholder handle the
-- user can change once.
create function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, handle)
  values (new.id, 'user_' || substr(replace(new.id::text, '-', ''), 1, 12));
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- Users may change their handle at most once per 30 days.
create function private.guard_profile_update() returns trigger
language plpgsql as $$
begin
  if new.handle is distinct from old.handle and auth.uid() is not null then
    if old.handle_changed_at is not null
       and old.handle_changed_at > now() - interval '30 days'
       and not private.is_moderator() then
      raise exception 'handle can be changed once every 30 days'
        using errcode = 'check_violation';
    end if;
    new.handle_changed_at := now();
  end if;
  return new;
end;
$$;

create trigger profiles_guard before update on public.profiles
  for each row execute function private.guard_profile_update();

-- ---------------------------------------------------------------------------
-- media
-- ---------------------------------------------------------------------------
create table public.media (
  id uuid primary key default gen_random_uuid(),
  kind public.media_kind not null,
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 120),
  title text not null check (char_length(title) between 1 and 300),
  original_title text check (original_title is null or char_length(original_title) <= 300),
  release_year smallint check (release_year is null or release_year between 1800 and 2100),
  synopsis text check (synopsis is null or char_length(synopsis) <= 5000),
  cover_url text check (cover_url is null or (cover_url ~ '^https://' and char_length(cover_url) <= 2000)),
  source public.media_source not null,
  external_id text check (external_id is null or char_length(external_id) <= 100),
  status public.content_status not null default 'pending',
  comments_locked boolean not null default false,
  merged_into uuid references public.media (id),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search tsvector generated always as (
    setweight(to_tsvector('simple'::regconfig, coalesce(title, '')), 'A')
    || setweight(to_tsvector('simple'::regconfig, coalesce(original_title, '')), 'B')
    || setweight(to_tsvector('simple'::regconfig, coalesce(synopsis, '')), 'C')
  ) stored,
  unique (source, external_id),
  -- Catalogue entries carry an external id; manual entries never do.
  check ((source = 'manual') = (external_id is null)),
  check (merged_into is null or merged_into <> id)
);

create index media_search_idx on public.media using gin (search);
create index media_kind_status_idx on public.media (kind, status, created_at desc);
create index media_created_by_idx on public.media (created_by);

create trigger media_updated_at before update on public.media
  for each row execute function private.set_updated_at();

-- On insert by a regular user: stamp the creator and decide the status.
-- Catalogue entries publish at once; manual entries wait for review unless
-- the creator is trust level 2. Moderators may set any status.
create function private.prepare_media_insert() returns trigger
language plpgsql as $$
begin
  if auth.uid() is not null and not private.is_moderator() then
    new.created_by := auth.uid();
    new.merged_into := null;
    new.comments_locked := false;
    if new.source <> 'manual' or private.trust_level() >= 2 then
      new.status := 'published';
    else
      new.status := 'pending';
    end if;
  end if;
  return new;
end;
$$;

create trigger media_prepare_insert before insert on public.media
  for each row execute function private.prepare_media_insert();

-- ---------------------------------------------------------------------------
-- contributors and credits
-- ---------------------------------------------------------------------------
create table public.contributors (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 300),
  kind public.contributor_kind not null,
  source public.media_source not null,
  external_id text check (external_id is null or char_length(external_id) <= 100),
  created_at timestamptz not null default now(),
  unique (source, external_id),
  check ((source = 'manual') = (external_id is null))
);

create table public.credits (
  media_id uuid not null references public.media (id) on delete cascade,
  contributor_id uuid not null references public.contributors (id) on delete cascade,
  role public.credit_role not null,
  character_name text check (character_name is null or char_length(character_name) <= 300),
  billing_order smallint check (billing_order is null or billing_order >= 0),
  primary key (media_id, contributor_id, role),
  check (character_name is null or role = 'actor')
);
create index credits_contributor_idx on public.credits (contributor_id);

-- Which roles fit which kind of title, and which roles are companies.
create function private.credit_role_allowed(k public.media_kind, r public.credit_role) returns boolean
language sql immutable as $$
  select case k
    when 'movie' then r in ('actor', 'director', 'writer', 'composer', 'studio')
    when 'tv_show' then r in ('actor', 'director', 'creator', 'writer', 'showrunner', 'composer', 'studio', 'network')
    when 'book' then r in ('author', 'illustrator', 'translator', 'publisher')
  end;
$$;

create function private.check_credit() returns trigger
language plpgsql as $$
declare
  m_kind public.media_kind;
  c_kind public.contributor_kind;
begin
  select kind into m_kind from public.media where id = new.media_id;
  select kind into c_kind from public.contributors where id = new.contributor_id;
  if not private.credit_role_allowed(m_kind, new.role) then
    raise exception 'role % is not allowed on a %', new.role, m_kind
      using errcode = 'check_violation';
  end if;
  if (new.role in ('studio', 'network', 'publisher')) <> (c_kind = 'company') then
    raise exception 'role % does not fit a % contributor', new.role, c_kind
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger credits_check before insert or update on public.credits
  for each row execute function private.check_credit();

-- ---------------------------------------------------------------------------
-- genres
-- ---------------------------------------------------------------------------
create table public.genres (
  id smallint generated always as identity primary key,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 50),
  kinds public.media_kind[] not null check (cardinality(kinds) >= 1)
);

create table public.media_genres (
  media_id uuid not null references public.media (id) on delete cascade,
  genre_id smallint not null references public.genres (id) on delete cascade,
  primary key (media_id, genre_id)
);
create index media_genres_genre_idx on public.media_genres (genre_id);

-- At most 3 genres per title, and only genres that fit the title's kind.
-- (The "at least 1" rule is enforced by the entry-creation service.)
create function private.check_media_genre() returns trigger
language plpgsql as $$
declare
  m_kind public.media_kind;
  g_kinds public.media_kind[];
begin
  select kind into m_kind from public.media where id = new.media_id;
  select kinds into g_kinds from public.genres where id = new.genre_id;
  if not (m_kind = any (g_kinds)) then
    raise exception 'genre does not apply to a %', m_kind using errcode = 'check_violation';
  end if;
  if (select count(*) from public.media_genres where media_id = new.media_id) >= 3 then
    raise exception 'a title can have at most 3 genres' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger media_genres_check before insert on public.media_genres
  for each row execute function private.check_media_genre();

-- ---------------------------------------------------------------------------
-- votes and tallies
-- ---------------------------------------------------------------------------
create table public.votes (
  user_id uuid not null references public.profiles (id) on delete cascade,
  media_id uuid not null references public.media (id) on delete cascade,
  value public.vote_value not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, media_id)
);
create index votes_media_idx on public.votes (media_id);

create trigger votes_updated_at before update on public.votes
  for each row execute function private.set_updated_at();

create table public.vote_tallies (
  media_id uuid primary key references public.media (id) on delete cascade,
  uses_ai integer not null default 0 check (uses_ai >= 0),
  no_ai integer not null default 0 check (no_ai >= 0),
  unsure integer not null default 0 check (unsure >= 0),
  counted_total integer generated always as (uses_ai + no_ai + unsure) stored,
  under_review boolean not null default false,
  updated_at timestamptz not null default now()
);
comment on table public.vote_tallies is
  'Maintained by triggers. Counts only votes from trust level 1+ accounts that are not banned.';

-- Recount one title from scratch. Cheap at this scale and never drifts.
create function private.recount_tally(m uuid) returns void
language sql security definer set search_path = '' as $$
  insert into public.vote_tallies as t (media_id, uses_ai, no_ai, unsure, updated_at)
  select
    m,
    count(*) filter (where v.value = 'uses_ai'),
    count(*) filter (where v.value = 'no_ai'),
    count(*) filter (where v.value = 'unsure'),
    now()
  from public.votes v
  join public.profiles p on p.id = v.user_id
  where v.media_id = m
    and p.trust_level >= 1
    and (p.banned_until is null or p.banned_until <= now())
  on conflict (media_id) do update set
    uses_ai = excluded.uses_ai,
    no_ai = excluded.no_ai,
    unsure = excluded.unsure,
    updated_at = excluded.updated_at;
$$;

create function private.on_vote_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform private.recount_tally(old.media_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') and (tg_op = 'INSERT' or new.media_id <> old.media_id) then
    perform private.recount_tally(new.media_id);
  end if;
  return null;
end;
$$;

create trigger votes_tally after insert or update or delete on public.votes
  for each row execute function private.on_vote_change();

-- New titles start with an empty tally row.
create function private.on_media_created() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.vote_tallies (media_id) values (new.id) on conflict do nothing;
  return null;
end;
$$;

create trigger media_tally after insert on public.media
  for each row execute function private.on_media_created();

-- When a voter's trust level or ban changes, their votes may start or stop
-- counting, so recount every title they voted on.
create function private.on_profile_standing_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  m uuid;
begin
  for m in select media_id from public.votes where user_id = new.id loop
    perform private.recount_tally(m);
  end loop;
  return null;
end;
$$;

create trigger profiles_standing after update of trust_level, banned_until on public.profiles
  for each row
  when (old.trust_level is distinct from new.trust_level
        or old.banned_until is distinct from new.banned_until)
  execute function private.on_profile_standing_change();

-- ---------------------------------------------------------------------------
-- comments
-- ---------------------------------------------------------------------------
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  media_id uuid not null references public.media (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  parent_id uuid references public.comments (id) on delete cascade,
  body text not null,
  evidence_url text check (evidence_url is null or (evidence_url ~ '^https://' and char_length(evidence_url) <= 2000)),
  ai_areas public.ai_area[] not null default '{}',
  status public.content_status not null default 'published',
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz,
  -- A soft-deleted comment keeps its place in the thread but loses its text.
  check (
    (deleted_at is null and char_length(body) between 1 and 2000)
    or (deleted_at is not null and body = '' and evidence_url is null and ai_areas = '{}')
  )
);
create index comments_media_idx on public.comments (media_id, created_at desc);
create index comments_user_idx on public.comments (user_id, created_at desc);
create index comments_parent_idx on public.comments (parent_id);

create function private.prepare_comment_insert() returns trigger
language plpgsql as $$
declare
  p record;
begin
  if auth.uid() is not null and not private.is_moderator() then
    new.user_id := auth.uid();
    new.status := 'published';
    new.created_at := now();
    new.edited_at := null;
    new.deleted_at := null;
  end if;
  if new.parent_id is not null then
    select media_id, parent_id into p from public.comments where id = new.parent_id;
    if p.parent_id is not null then
      raise exception 'replies can only be one level deep' using errcode = 'check_violation';
    end if;
    if p.media_id <> new.media_id then
      raise exception 'reply must be on the same title' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

create trigger comments_prepare_insert before insert on public.comments
  for each row execute function private.prepare_comment_insert();

-- Authors may edit text for 15 minutes and soft delete at any time.
-- Only moderators change status. Nobody moves a comment.
create function private.guard_comment_update() returns trigger
language plpgsql as $$
declare
  is_mod boolean := private.is_moderator();
  is_author boolean := (auth.uid() is not null and auth.uid() = old.user_id);
  text_changed boolean := (
    new.body is distinct from old.body
    or new.evidence_url is distinct from old.evidence_url
    or new.ai_areas is distinct from old.ai_areas
  );
begin
  if auth.uid() is null then
    return new; -- service role / migrations
  end if;
  if new.media_id <> old.media_id or new.user_id is distinct from old.user_id
     or new.parent_id is distinct from old.parent_id or new.created_at <> old.created_at then
    raise exception 'comment identity fields cannot change' using errcode = 'insufficient_privilege';
  end if;
  if new.status <> old.status and not is_mod then
    raise exception 'only moderators can change comment status' using errcode = 'insufficient_privilege';
  end if;
  if old.deleted_at is not null and new.deleted_at is null and not is_mod then
    raise exception 'deleted comments cannot be restored' using errcode = 'insufficient_privilege';
  end if;

  if new.deleted_at is not null and old.deleted_at is null then
    -- Soft delete: author or moderator.
    if not (is_author or is_mod) then
      raise exception 'not allowed' using errcode = 'insufficient_privilege';
    end if;
    new.deleted_at := now();
    new.body := '';
    new.evidence_url := null;
    new.ai_areas := '{}';
  elsif text_changed then
    if not is_author then
      raise exception 'only the author can edit a comment' using errcode = 'insufficient_privilege';
    end if;
    if old.deleted_at is not null then
      raise exception 'deleted comments cannot be edited' using errcode = 'insufficient_privilege';
    end if;
    if now() > old.created_at + interval '15 minutes' then
      raise exception 'comments can only be edited for 15 minutes' using errcode = 'check_violation';
    end if;
    new.edited_at := now();
  end if;
  return new;
end;
$$;

create trigger comments_guard_update before update on public.comments
  for each row execute function private.guard_comment_update();

-- ---------------------------------------------------------------------------
-- reports
-- ---------------------------------------------------------------------------
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles (id) on delete set null,
  target_type public.report_target not null,
  target_id uuid not null,
  reason public.report_reason not null,
  note text check (note is null or char_length(note) <= 1000),
  status public.report_status not null default 'open',
  handled_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  handled_at timestamptz
);
-- One open report per reporter per target.
create unique index reports_one_open_idx on public.reports (reporter_id, target_type, target_id)
  where status = 'open';
create index reports_queue_idx on public.reports (status, created_at);

create function private.prepare_report_insert() returns trigger
language plpgsql as $$
begin
  if auth.uid() is not null and not private.is_moderator() then
    new.reporter_id := auth.uid();
    new.status := 'open';
    new.handled_by := null;
    new.handled_at := null;
  end if;
  return new;
end;
$$;

create trigger reports_prepare_insert before insert on public.reports
  for each row execute function private.prepare_report_insert();

-- ---------------------------------------------------------------------------
-- mod_actions: append-only audit log
-- ---------------------------------------------------------------------------
create table public.mod_actions (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  action public.mod_action_type not null,
  target_type public.report_target not null,
  target_id uuid not null,
  reason text check (reason is null or char_length(reason) <= 1000),
  created_at timestamptz not null default now()
);
create index mod_actions_target_idx on public.mod_actions (target_type, target_id, created_at desc);

create function private.forbid_change() returns trigger
language plpgsql as $$
begin
  raise exception '% is append-only', tg_table_name using errcode = 'insufficient_privilege';
end;
$$;

-- Applies to every role, including admins and the service role.
create trigger mod_actions_append_only before update or delete on public.mod_actions
  for each row execute function private.forbid_change();
create trigger mod_actions_no_truncate before truncate on public.mod_actions
  for each statement execute function private.forbid_change();

-- ---------------------------------------------------------------------------
-- Scheduled job: promote trust level 0 -> 1 once the email is verified and
-- the account is at least 72 hours old. Called nightly with the service role.
-- ---------------------------------------------------------------------------
create function public.refresh_trust_levels() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  n integer;
begin
  update public.profiles p
  set trust_level = 1
  from auth.users u
  where u.id = p.id
    and p.trust_level = 0
    and u.email_confirmed_at is not null
    and p.created_at <= now() - interval '72 hours';
  get diagnostics n = row_count;
  return n;
end;
$$;

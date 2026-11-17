-- Row Level Security and grants. Deny by default at two levels:
--   1. table/column GRANTs decide which operations a role can attempt at all;
--   2. RLS policies decide which rows those operations may touch.
-- The service_role bypasses RLS and is used only by moderator tools and jobs.

-- ---------------------------------------------------------------------------
-- Start from nothing, whatever the project's default privileges are.
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated, public;
revoke all on schema private from anon, authenticated, public;
revoke all on all functions in schema private from anon, authenticated, public;

grant usage on schema private to anon, authenticated;
grant execute on function
  private.is_moderator(),
  private.is_admin(),
  private.is_verified(),
  private.trust_level(),
  private.set_updated_at(),
  private.guard_profile_update(),
  private.prepare_media_insert(),
  private.credit_role_allowed(public.media_kind, public.credit_role),
  private.check_credit(),
  private.check_media_genre(),
  private.prepare_comment_insert(),
  private.guard_comment_update(),
  private.prepare_report_insert(),
  private.forbid_change()
to anon, authenticated;

grant usage on schema private to service_role;
grant execute on all functions in schema private to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on function public.refresh_trust_levels() to service_role;

alter table public.profiles enable row level security;
alter table public.media enable row level security;
alter table public.contributors enable row level security;
alter table public.credits enable row level security;
alter table public.genres enable row level security;
alter table public.media_genres enable row level security;
alter table public.votes enable row level security;
alter table public.vote_tallies enable row level security;
alter table public.comments enable row level security;
alter table public.reports enable row level security;
alter table public.mod_actions enable row level security;

-- Visible title = published, or yours, or you moderate.
create function private.media_visible(m uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.media x
    where x.id = m
      and (x.status = 'published' or x.created_by = auth.uid() or private.is_moderator())
  );
$$;

create function private.media_published(m uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.media x where x.id = m and x.status = 'published');
$$;

create function private.can_edit_media(m uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_moderator() or exists (
    select 1 from public.media x
    where x.id = m and x.created_by = auth.uid() and private.is_verified()
  );
$$;

create function private.comments_open(m uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.media x
    where x.id = m and x.status = 'published' and not x.comments_locked
  );
$$;

create function private.votes_public(u uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = u and p.show_votes);
$$;

revoke all on function
  private.media_visible(uuid), private.media_published(uuid), private.can_edit_media(uuid),
  private.comments_open(uuid), private.votes_public(uuid)
from public;
grant execute on function
  private.media_visible(uuid), private.media_published(uuid), private.can_edit_media(uuid),
  private.comments_open(uuid), private.votes_public(uuid)
to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- profiles: public card; trust_level and banned_until are not public.
-- ---------------------------------------------------------------------------
grant select (id, handle, display_name, avatar_path, role, show_votes, created_at)
  on public.profiles to anon, authenticated;
grant update (handle, display_name, avatar_path, show_votes)
  on public.profiles to authenticated;

create policy profiles_select on public.profiles
  for select to anon, authenticated using (true);
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- The signed-in user's own full profile, including private fields.
create function public.my_profile()
returns table (
  id uuid, handle text, display_name text, avatar_path text, role public.user_role,
  trust_level smallint, show_votes boolean, banned_until timestamptz,
  email_verified boolean, created_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select p.id, p.handle, p.display_name, p.avatar_path, p.role, p.trust_level,
         p.show_votes, p.banned_until, (u.email_confirmed_at is not null), p.created_at
  from public.profiles p join auth.users u on u.id = p.id
  where p.id = auth.uid();
$$;
revoke all on function public.my_profile() from public, anon;
grant execute on function public.my_profile() to authenticated;

-- ---------------------------------------------------------------------------
-- media
-- ---------------------------------------------------------------------------
grant select on public.media to anon, authenticated;
grant insert (kind, slug, title, original_title, release_year, synopsis, cover_url, source, external_id)
  on public.media to authenticated;
grant update on public.media to authenticated; -- narrowed to moderators by policy

create policy media_select on public.media
  for select to anon, authenticated
  using (status = 'published' or created_by = auth.uid() or private.is_moderator());
create policy media_insert on public.media
  for insert to authenticated
  with check (private.is_verified() and private.trust_level() >= 1);
create policy media_update_mod on public.media
  for update to authenticated
  using (private.is_moderator()) with check (private.is_moderator());

-- ---------------------------------------------------------------------------
-- contributors and credits
-- ---------------------------------------------------------------------------
grant select on public.contributors to anon, authenticated;
grant insert (name, kind, source, external_id) on public.contributors to authenticated;
grant update (name) on public.contributors to authenticated;

create policy contributors_select on public.contributors
  for select to anon, authenticated using (true);
create policy contributors_insert on public.contributors
  for insert to authenticated
  with check (private.is_verified() and private.trust_level() >= 1);
create policy contributors_update_mod on public.contributors
  for update to authenticated using (private.is_moderator()) with check (private.is_moderator());

grant select on public.credits to anon, authenticated;
grant insert, update, delete on public.credits to authenticated;

create policy credits_select on public.credits
  for select to anon, authenticated using (private.media_visible(media_id));
create policy credits_insert on public.credits
  for insert to authenticated with check (private.can_edit_media(media_id));
create policy credits_update on public.credits
  for update to authenticated
  using (private.can_edit_media(media_id)) with check (private.can_edit_media(media_id));
create policy credits_delete on public.credits
  for delete to authenticated using (private.can_edit_media(media_id));

-- ---------------------------------------------------------------------------
-- genres and media_genres
-- ---------------------------------------------------------------------------
grant select on public.genres to anon, authenticated;
grant insert, update, delete on public.genres to authenticated; -- admins only, by policy

create policy genres_select on public.genres
  for select to anon, authenticated using (true);
create policy genres_admin_insert on public.genres
  for insert to authenticated with check (private.is_admin());
create policy genres_admin_update on public.genres
  for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy genres_admin_delete on public.genres
  for delete to authenticated using (private.is_admin());

grant select on public.media_genres to anon, authenticated;
grant insert, delete on public.media_genres to authenticated;

create policy media_genres_select on public.media_genres
  for select to anon, authenticated using (private.media_visible(media_id));
create policy media_genres_insert on public.media_genres
  for insert to authenticated with check (private.can_edit_media(media_id));
create policy media_genres_delete on public.media_genres
  for delete to authenticated using (private.can_edit_media(media_id));

-- ---------------------------------------------------------------------------
-- votes: private unless the voter turned on show_votes.
-- ---------------------------------------------------------------------------
grant select on public.votes to anon, authenticated;
grant insert (media_id, value) on public.votes to authenticated;
grant update (value) on public.votes to authenticated;
grant delete on public.votes to authenticated;

-- user_id defaults to the caller so clients never send it.
alter table public.votes alter column user_id set default auth.uid();

create policy votes_select on public.votes
  for select to anon, authenticated
  using (user_id = auth.uid() or private.votes_public(user_id));
create policy votes_insert_own on public.votes
  for insert to authenticated
  with check (user_id = auth.uid() and private.is_verified() and private.media_published(media_id));
create policy votes_update_own on public.votes
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and private.is_verified() and private.media_published(media_id));
create policy votes_delete_own on public.votes
  for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- vote_tallies: public read, written only by triggers.
-- ---------------------------------------------------------------------------
grant select on public.vote_tallies to anon, authenticated;

create policy vote_tallies_select on public.vote_tallies
  for select to anon, authenticated using (private.media_visible(media_id));

-- ---------------------------------------------------------------------------
-- comments
-- ---------------------------------------------------------------------------
grant select on public.comments to anon, authenticated;
grant insert (media_id, parent_id, body, evidence_url, ai_areas) on public.comments to authenticated;
grant update (body, evidence_url, ai_areas, status, deleted_at) on public.comments to authenticated;

create policy comments_select on public.comments
  for select to anon, authenticated
  using (
    (status = 'published' and private.media_published(media_id))
    or user_id = auth.uid()
    or private.is_moderator()
  );
create policy comments_insert on public.comments
  for insert to authenticated
  with check (user_id = auth.uid() and private.is_verified() and private.comments_open(media_id));
create policy comments_update on public.comments
  for update to authenticated
  using (user_id = auth.uid() or private.is_moderator())
  with check (user_id = auth.uid() or private.is_moderator());

-- ---------------------------------------------------------------------------
-- reports
-- ---------------------------------------------------------------------------
grant select on public.reports to authenticated;
grant insert (target_type, target_id, reason, note) on public.reports to authenticated;
grant update (status, handled_by, handled_at) on public.reports to authenticated;

create policy reports_select on public.reports
  for select to authenticated using (reporter_id = auth.uid() or private.is_moderator());
create policy reports_insert on public.reports
  for insert to authenticated with check (reporter_id = auth.uid() and private.is_verified());
create policy reports_update_mod on public.reports
  for update to authenticated using (private.is_moderator()) with check (private.is_moderator());

-- ---------------------------------------------------------------------------
-- mod_actions: moderators read and append; nobody edits or deletes.
-- ---------------------------------------------------------------------------
grant select on public.mod_actions to authenticated;
grant insert (action, target_type, target_id, reason) on public.mod_actions to authenticated;

alter table public.mod_actions alter column actor_id set default auth.uid();

create policy mod_actions_select on public.mod_actions
  for select to authenticated using (private.is_moderator());
create policy mod_actions_insert on public.mod_actions
  for insert to authenticated with check (private.is_moderator() and actor_id = auth.uid());

-- Moderators and admins act with their extra powers only from a session that
-- passed 2-step login (TOTP), which Supabase marks as aal2 in the JWT.
-- From an aal1 session they are treated like any other member, so a stolen
-- password alone cannot hide content, ban people or change roles.
--
-- Every moderator check in RLS, triggers and moderate() goes through these
-- two functions, so this is the single place the rule lives.

create or replace function private.has_aal2() returns boolean
language sql stable set search_path = '' as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2';
$$;

create or replace function private.is_moderator() returns boolean
language sql stable security definer set search_path = '' as $$
  select private.has_aal2() and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('moderator', 'admin')
  );
$$;

create or replace function private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select private.has_aal2() and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

revoke all on function private.has_aal2() from public;
grant execute on function private.has_aal2() to authenticated;

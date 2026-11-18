-- Moderation: report checks and limits, auto-hide of heavily reported
-- comments, and one function that performs every moderator action and logs
-- it to mod_actions in the same transaction.

-- ---------------------------------------------------------------------------
-- Reports: 20 a day per user, the target must exist and be visible to the
-- reporter, and nobody reports themselves.
-- ---------------------------------------------------------------------------
create function private.check_report_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  ok boolean;
begin
  if auth.uid() is null then
    return new;
  end if;
  perform private.rate_limit('report', 20, interval '1 day');
  case new.target_type
    when 'media' then
      select exists (select 1 from public.media m where m.id = new.target_id and m.status = 'published') into ok;
    when 'comment' then
      select exists (
        select 1 from public.comments c
        where c.id = new.target_id and c.status = 'published' and c.deleted_at is null
          and c.user_id is distinct from auth.uid()
      ) into ok;
    when 'profile' then
      ok := new.target_id <> auth.uid() and exists (select 1 from public.profiles p where p.id = new.target_id);
  end case;
  if not ok then
    raise exception 'nothing to report' using errcode = 'P0002';
  end if;
  return new;
end;
$$;

-- Fires after reports_prepare_insert (alphabetical), which sets reporter_id.
create trigger reports_check_insert before insert on public.reports
  for each row execute function private.check_report_insert();

-- Three open reports from distinct trust 1+ users, or one from a trust 2
-- user, hide a comment until a moderator reviews it.
create function private.auto_hide_reported_comment() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  weight integer;
  hidden integer;
  claims text := current_setting('request.jwt.claims', true);
begin
  if new.target_type <> 'comment' then
    return null;
  end if;
  select coalesce(sum(case when p.trust_level >= 2 then 3 else 1 end), 0)::int into weight
  from public.reports r
  join public.profiles p on p.id = r.reporter_id
  where r.target_type = 'comment' and r.target_id = new.target_id and r.status = 'open'
    and p.trust_level >= 1;
  if weight >= 3 then
    -- Act as the system, not the reporter, so the comment guard allows the
    -- status change. The caller's claims are restored right after.
    perform set_config('request.jwt.claims', '{}', true);
    update public.comments set status = 'hidden'
    where id = new.target_id and status = 'published';
    get diagnostics hidden = row_count;
    perform set_config('request.jwt.claims', coalesce(claims, ''), true);
    if hidden > 0 then
      insert into public.mod_actions (actor_id, action, target_type, target_id, reason)
      values (null, 'hide', 'comment', new.target_id, 'Hidden automatically after reports');
    end if;
  end if;
  return null;
end;
$$;

create trigger reports_auto_hide after insert on public.reports
  for each row execute function private.auto_hide_reported_comment();

revoke all on function private.check_report_insert(), private.auto_hide_reported_comment() from public;

-- ---------------------------------------------------------------------------
-- public.moderate(): every moderator action goes through here.
--   hide | restore | remove   comment or media: set its status
--   lock_comments             media: p_value 1 locks, 0 unlocks
--   ban                       profile: p_value days (null = indefinitely)
--   unban                     profile
--   set_trust                 profile: p_value 0 to 2
--   set_role                  profile, admins only: p_value 0 user, 1 moderator, 2 admin
--   dismiss_report            any target: closes its open reports, nothing else
-- Open reports on the target are closed as actioned (or dismissed).
-- ---------------------------------------------------------------------------
create function public.moderate(
  p_action public.mod_action_type,
  p_target_type public.report_target,
  p_target uuid,
  p_reason text default null,
  p_value integer default null
) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  target_role public.user_role;
  log_id bigint;
  n integer;
begin
  if me is null or not private.is_moderator() or not private.is_verified() then
    raise exception 'moderators only' using errcode = '42501';
  end if;
  if p_reason is not null and char_length(p_reason) > 1000 then
    raise exception 'reason is too long' using errcode = '22001';
  end if;
  perform private.rate_limit('moderate', 60, interval '1 minute');

  if p_target_type = 'profile' then
    select role into target_role from public.profiles where id = p_target;
    if not found then
      raise exception 'no such profile' using errcode = 'P0002';
    end if;
    if p_target = me and p_action <> 'dismiss_report' then
      raise exception 'you cannot moderate yourself' using errcode = '42501';
    end if;
    -- Only admins act on other moderators and admins.
    if target_role <> 'user' and not private.is_admin() and p_action <> 'dismiss_report' then
      raise exception 'only admins can moderate moderators' using errcode = '42501';
    end if;
  end if;

  case
    when p_action in ('hide', 'restore', 'remove') then
      if p_target_type = 'comment' then
        update public.comments
        set status = case p_action when 'hide' then 'hidden' when 'remove' then 'removed' else 'published' end::public.content_status
        where id = p_target;
      elsif p_target_type = 'media' then
        update public.media
        set status = case p_action when 'hide' then 'hidden' when 'remove' then 'removed' else 'published' end::public.content_status
        where id = p_target;
      else
        raise exception 'hide, restore and remove apply to comments and titles' using errcode = '22023';
      end if;
    when p_action = 'lock_comments' then
      if p_target_type <> 'media' or p_value not in (0, 1) then
        raise exception 'lock_comments needs a title and 0 or 1' using errcode = '22023';
      end if;
      update public.media set comments_locked = (p_value = 1) where id = p_target;
    when p_action in ('ban', 'unban') then
      if p_target_type <> 'profile' or (p_action = 'ban' and p_value is not null and p_value not between 1 and 3650) then
        raise exception 'ban needs a profile and 1 to 3650 days' using errcode = '22023';
      end if;
      update public.profiles
      set banned_until = case when p_action = 'unban' then null
                              when p_value is null then 'infinity'::timestamptz
                              else now() + make_interval(days => p_value) end
      where id = p_target;
    when p_action = 'set_trust' then
      if p_target_type <> 'profile' or p_value not between 0 and 2 then
        raise exception 'set_trust needs a profile and 0 to 2' using errcode = '22023';
      end if;
      update public.profiles set trust_level = p_value::smallint where id = p_target;
    when p_action = 'set_role' then
      if not private.is_admin() then
        raise exception 'only admins can change roles' using errcode = '42501';
      end if;
      if p_target_type <> 'profile' or p_value not between 0 and 2 then
        raise exception 'set_role needs a profile and 0 to 2' using errcode = '22023';
      end if;
      update public.profiles
      set role = (array['user', 'moderator', 'admin']::public.user_role[])[p_value + 1]
      where id = p_target;
    when p_action = 'dismiss_report' then
      null;
    else
      raise exception 'unsupported action' using errcode = '22023';
  end case;

  get diagnostics n = row_count;
  if p_action <> 'dismiss_report' and n = 0 then
    raise exception 'target not found' using errcode = 'P0002';
  end if;

  update public.reports
  set status = case when p_action in ('dismiss_report', 'restore', 'unban') then 'dismissed' else 'actioned' end::public.report_status,
      handled_by = me,
      handled_at = now()
  where target_type = p_target_type and target_id = p_target and status = 'open';

  insert into public.mod_actions (actor_id, action, target_type, target_id, reason)
  values (me, p_action, p_target_type, p_target, nullif(trim(p_reason), ''))
  returning id into log_id;
  return log_id;
end;
$$;
revoke all on function public.moderate(public.mod_action_type, public.report_target, uuid, text, integer) from public, anon;
grant execute on function public.moderate(public.mod_action_type, public.report_target, uuid, text, integer) to authenticated;

-- Standing of reported profiles for the moderator queue. trust_level and
-- banned_until are not public columns, so this checks the caller itself.
create function public.mod_profile_cards(p_ids uuid[])
returns table (id uuid, handle text, display_name text, role public.user_role, trust_level smallint, banned_until timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_moderator() then
    raise exception 'moderators only' using errcode = '42501';
  end if;
  return query
    select p.id, p.handle, p.display_name, p.role, p.trust_level, p.banned_until
    from public.profiles p where p.id = any (p_ids[1:200]);
end;
$$;
revoke all on function public.mod_profile_cards(uuid[]) from public, anon;
grant execute on function public.mod_profile_cards(uuid[]) to authenticated;

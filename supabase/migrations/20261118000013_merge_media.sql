-- Duplicate titles: a moderator merges one entry into the one that stays.
-- Votes and comments move to the survivor (a member who voted on both keeps
-- their vote on the survivor), open reports on the duplicate are closed, and
-- the duplicate's page redirects to the survivor through merged_into.

create function public.merge_media(p_from uuid, p_into uuid, p_reason text default null)
returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  src public.media;
  dst public.media;
  claims text := current_setting('request.jwt.claims', true);
  log_id bigint;
begin
  if me is null or not private.is_moderator() or not private.is_verified() then
    raise exception 'moderators only' using errcode = '42501';
  end if;
  if p_reason is not null and char_length(p_reason) > 900 then
    raise exception 'reason is too long' using errcode = '22001';
  end if;
  perform private.rate_limit('moderate', 60, interval '1 minute');

  if p_from = p_into then
    raise exception 'a title cannot be merged into itself' using errcode = '22023';
  end if;
  -- Lock both rows in a fixed order so two merges cannot deadlock.
  perform 1 from public.media where id in (p_from, p_into) order by id for update;
  select * into src from public.media where id = p_from;
  select * into dst from public.media where id = p_into;
  if src.id is null or dst.id is null then
    raise exception 'no such title' using errcode = 'P0002';
  end if;
  if src.merged_into is not null then
    raise exception 'that title was already merged' using errcode = '22023';
  end if;
  if dst.merged_into is not null or dst.status <> 'published' then
    raise exception 'the title to keep must be published and not merged' using errcode = '22023';
  end if;
  if src.kind <> dst.kind then
    raise exception 'both titles must be the same kind' using errcode = '22023';
  end if;

  -- Act as the system so the comment guard and rate limits allow the moves.
  perform set_config('request.jwt.claims', '{}', true);

  delete from public.votes v
  where v.media_id = p_from
    and exists (select 1 from public.votes k where k.media_id = p_into and k.user_id = v.user_id);
  update public.votes set media_id = p_into where media_id = p_from;
  update public.comments set media_id = p_into where media_id = p_from;
  -- Earlier merges into the duplicate now point straight at the survivor.
  update public.media set merged_into = p_into where merged_into = p_from;
  update public.media set merged_into = p_into where id = p_from;
  delete from public.trending_media where media_id = p_from;

  perform set_config('request.jwt.claims', coalesce(claims, ''), true);

  update public.reports
  set status = 'actioned', handled_by = me, handled_at = now()
  where target_type = 'media' and target_id = p_from and status = 'open';

  insert into public.mod_actions (actor_id, action, target_type, target_id, reason)
  values (me, 'merge', 'media', p_from,
          'Merged into ' || dst.slug || coalesce(': ' || nullif(trim(p_reason), ''), ''))
  returning id into log_id;
  return log_id;
end;
$$;
revoke all on function public.merge_media(uuid, uuid, text) from public, anon;
grant execute on function public.merge_media(uuid, uuid, text) to authenticated;

-- Moderators and admins post, report and add titles under their own name.
--
-- The insert triggers below skipped all stamping for moderators, so that
-- staff could set status freely. Since 2-step login made is_moderator() true
-- for staff sessions, that also skipped stamping the author: user_id,
-- reporter_id and created_by stayed null, and the "own row" insert policies
-- refused a moderator's comment or report ("You can't comment here").
--
-- Clients can't write these columns (column grants), so the signed-in caller
-- is always the author. Only the rest of the stamping stays member-only.

create or replace function private.prepare_comment_insert() returns trigger
language plpgsql as $$
declare
  p record;
begin
  if auth.uid() is not null then
    new.user_id := auth.uid();
    if not private.is_moderator() then
      new.status := 'published';
      new.created_at := now();
      new.edited_at := null;
      new.deleted_at := null;
    end if;
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

create or replace function private.prepare_report_insert() returns trigger
language plpgsql as $$
begin
  if auth.uid() is not null then
    new.reporter_id := auth.uid();
    if not private.is_moderator() then
      new.status := 'open';
      new.handled_by := null;
      new.handled_at := null;
    end if;
  end if;
  return new;
end;
$$;

create or replace function private.prepare_media_insert() returns trigger
language plpgsql as $$
begin
  if auth.uid() is not null then
    new.created_by := auth.uid();
    if not private.is_moderator() then
      new.merged_into := null;
      new.comments_locked := false;
      if new.source <> 'manual' or private.trust_level() >= 2 then
        new.status := 'published';
      else
        new.status := 'pending';
      end if;
    end if;
  end if;
  return new;
end;
$$;

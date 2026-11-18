-- Anime and manga (see the previous migration for the new enum values):
-- which credit roles fit them, which genres apply, merging a TMDB or Open
-- Library entry into its AniList twin, and spotting such twins when a
-- member adds a title.

-- ---------------------------------------------------------------------------
-- Credit roles. Anime credits voice actors as "actor"; manga credits the
-- writer as "author" and the artist as "illustrator".
-- ---------------------------------------------------------------------------
create or replace function private.credit_role_allowed(k public.media_kind, r public.credit_role) returns boolean
language sql immutable as $$
  select case k
    when 'movie' then r in ('actor', 'director', 'writer', 'composer', 'studio')
    when 'tv_show' then r in ('actor', 'director', 'creator', 'writer', 'showrunner', 'composer', 'studio', 'network')
    when 'book' then r in ('author', 'illustrator', 'translator', 'publisher')
    when 'anime' then r in ('actor', 'director', 'creator', 'writer', 'composer', 'studio')
    when 'manga' then r in ('author', 'illustrator', 'translator', 'publisher')
  end;
$$;

-- ---------------------------------------------------------------------------
-- Genres: the shared ones gain anime and manga, plus four that mostly
-- matter for anime and manga.
-- ---------------------------------------------------------------------------
update public.genres set kinds = kinds || '{anime,manga}'::public.media_kind[]
where slug in ('action', 'comedy', 'drama', 'horror', 'sci-fi', 'fantasy', 'romance', 'thriller', 'mystery', 'crime', 'history');
update public.genres set kinds = kinds || '{anime}'::public.media_kind[]
where slug in ('family');
update public.genres set kinds = kinds || '{manga}'::public.media_kind[]
where slug in ('young-adult', 'childrens');

insert into public.genres (slug, name, kinds) values
  ('slice-of-life', 'Slice of life', '{anime,manga,tv_show,book}'),
  ('sports',        'Sports',        '{anime,manga,movie,tv_show}'),
  ('mecha',         'Mecha',         '{anime,manga}'),
  ('psychological', 'Psychological', '{anime,manga,movie,tv_show,book}');

-- ---------------------------------------------------------------------------
-- Twins across catalogues: most anime is also on TMDB as a TV show or film,
-- and some manga is on Open Library as a book. A moderator may merge such a
-- pair, in either direction.
-- ---------------------------------------------------------------------------
create function private.kinds_mergeable(a public.media_kind, b public.media_kind) returns boolean
language sql immutable as $$
  select a = b
    or (a = 'anime' and b in ('tv_show', 'movie')) or (b = 'anime' and a in ('tv_show', 'movie'))
    or (a = 'manga' and b = 'book') or (b = 'manga' and a = 'book');
$$;
grant execute on function private.kinds_mergeable(public.media_kind, public.media_kind) to authenticated, service_role;

create or replace function public.merge_media(p_from uuid, p_into uuid, p_reason text default null)
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
  if not private.kinds_mergeable(src.kind, dst.kind) then
    raise exception 'both titles must be the same kind, or anime with a TV show or film, or manga with a book' using errcode = '22023';
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

-- Published titles of the given kinds whose title or original title is one
-- of the given names (case-insensitive). Used to warn "this may already be
-- here as a TV show" before a member adds an anime, and the other way round.
create function public.similar_titles(p_kinds public.media_kind[], p_titles text[])
returns table (slug text, title text, original_title text, kind public.media_kind, release_year smallint)
language sql stable security invoker set search_path = '' as $$
  select m.slug, m.title, m.original_title, m.kind, m.release_year
  from public.media m
  where m.status = 'published'
    and m.merged_into is null
    and m.kind = any (p_kinds)
    and (lower(m.title) = any (select lower(t) from unnest(p_titles[1:100]) t)
         or lower(m.original_title) = any (select lower(t) from unnest(p_titles[1:100]) t))
  order by m.created_at
  limit 20;
$$;
revoke all on function public.similar_titles(public.media_kind[], text[]) from public, anon;
grant execute on function public.similar_titles(public.media_kind[], text[]) to authenticated, service_role;

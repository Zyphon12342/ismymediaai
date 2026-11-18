-- Titles: atomic entry creation with credits and genres, browse and search,
-- and rate limits on entry creation and catalogue lookups.

-- ---------------------------------------------------------------------------
-- Fixed per-route limits a signed-in caller can be checked against. The
-- caller picks only the bucket, never the numbers.
-- ---------------------------------------------------------------------------
create function public.rate_limit_check(p_bucket text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  case p_bucket
    when 'lookup' then perform private.rate_limit('lookup', 30, interval '1 minute');
    else raise exception 'unknown rate limit bucket' using errcode = '22023';
  end case;
end;
$$;
revoke all on function public.rate_limit_check(text) from public, anon;
grant execute on function public.rate_limit_check(text) to authenticated, service_role;

-- Five new titles a day per user (moderators are not limited).
create function private.rate_limit_media_insert() returns trigger
language plpgsql as $$
begin
  perform private.rate_limit('media_create', 5, interval '1 day');
  return new;
end;
$$;
grant execute on function private.rate_limit_media_insert() to authenticated, service_role;

create trigger media_rate_limit before insert on public.media
  for each row execute function private.rate_limit_media_insert();

-- Slugs are unique across all titles, including ones the caller cannot see.
create function private.slug_taken(s text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.media where slug = s);
$$;
revoke all on function private.slug_taken(text) from public;
grant execute on function private.slug_taken(text) to authenticated, service_role;

-- An existing title for a catalogue id, if the caller may see it.
create function private.existing_catalogue_slug(src public.media_source, ext text) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce(m2.slug, m.slug)
  from public.media m
  left join public.media m2 on m2.id = m.merged_into
  where m.source = src and m.external_id = ext
  limit 1;
$$;
revoke all on function private.existing_catalogue_slug(public.media_source, text) from public;
grant execute on function private.existing_catalogue_slug(public.media_source, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- create_media: one transaction for the title, its genres and its credits.
-- SECURITY INVOKER, so every insert goes through the caller's RLS policies,
-- the media triggers (status, creator, rate limit) and the credit checks.
-- ---------------------------------------------------------------------------
create function public.create_media(p jsonb)
returns table (id uuid, slug text, status public.content_status, existing boolean)
language plpgsql security invoker set search_path = '' as $$
declare
  v_kind public.media_kind := (p ->> 'kind')::public.media_kind;
  v_source public.media_source := (p ->> 'source')::public.media_source;
  v_ext text := nullif(p ->> 'external_id', '');
  v_base text := p ->> 'slug';
  v_slug text;
  v_id uuid;
  v_status public.content_status;
  v_existing text;
  v_genres text[] := array(select jsonb_array_elements_text(coalesce(p -> 'genres', '[]'::jsonb)));
  v_credit jsonb;
  v_contributor uuid;
  n integer := 1;
begin
  if cardinality(v_genres) < 1 or cardinality(v_genres) > 3 then
    raise exception 'pick 1 to 3 genres' using errcode = 'check_violation';
  end if;
  if jsonb_array_length(coalesce(p -> 'credits', '[]'::jsonb)) > 40 then
    raise exception 'too many credits' using errcode = 'check_violation';
  end if;
  if v_base is null or v_base !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or char_length(v_base) > 110 then
    raise exception 'invalid slug' using errcode = 'check_violation';
  end if;

  if v_ext is not null then
    v_existing := private.existing_catalogue_slug(v_source, v_ext);
    if v_existing is not null then
      return query select null::uuid, v_existing, null::public.content_status, true;
      return;
    end if;
  end if;

  v_slug := v_base;
  while private.slug_taken(v_slug) loop
    n := n + 1;
    if n > 50 then
      raise exception 'could not find a free slug' using errcode = 'unique_violation';
    end if;
    v_slug := v_base || '-' || n;
  end loop;

  insert into public.media (kind, slug, title, original_title, release_year, synopsis, cover_url, source, external_id)
  values (
    v_kind, v_slug, p ->> 'title', nullif(p ->> 'original_title', ''),
    nullif(p ->> 'release_year', '')::smallint, nullif(p ->> 'synopsis', ''),
    nullif(p ->> 'cover_url', ''), v_source, v_ext
  )
  returning media.id, media.status into v_id, v_status;

  insert into public.media_genres (media_id, genre_id)
  select v_id, g.id from public.genres g where g.slug = any (v_genres);
  if (select count(*) from public.media_genres mg where mg.media_id = v_id) <> cardinality(v_genres) then
    raise exception 'unknown genre' using errcode = 'check_violation';
  end if;

  for v_credit in select * from jsonb_array_elements(coalesce(p -> 'credits', '[]'::jsonb)) loop
    v_contributor := null;
    if nullif(v_credit ->> 'external_id', '') is not null then
      insert into public.contributors (name, kind, source, external_id)
      values (v_credit ->> 'name', (v_credit ->> 'kind')::public.contributor_kind, v_source, v_credit ->> 'external_id')
      on conflict (source, external_id) do nothing
      returning contributors.id into v_contributor;
      if v_contributor is null then
        select c.id into v_contributor from public.contributors c
        where c.source = v_source and c.external_id = v_credit ->> 'external_id';
      end if;
    else
      insert into public.contributors (name, kind, source)
      values (v_credit ->> 'name', (v_credit ->> 'kind')::public.contributor_kind, 'manual')
      returning contributors.id into v_contributor;
    end if;
    insert into public.credits (media_id, contributor_id, role, character_name, billing_order)
    values (
      v_id, v_contributor, (v_credit ->> 'role')::public.credit_role,
      nullif(v_credit ->> 'character_name', ''), nullif(v_credit ->> 'billing_order', '')::smallint
    )
    on conflict do nothing;
  end loop;

  return query select v_id, v_slug, v_status, false;
end;
$$;
revoke all on function public.create_media(jsonb) from public, anon;
grant execute on function public.create_media(jsonb) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Browse and search published titles.
-- ---------------------------------------------------------------------------
create index media_genres_media_idx on public.media_genres (media_id);

-- Prefix search over title words: "star wa" matches "Star Wars".
create function private.prefix_tsquery(q text) returns tsquery
language sql immutable set search_path = '' as $$
  select case when w is null then null else to_tsquery('simple'::regconfig, w) end
  from (
    select string_agg(t || ':*', ' & ') as w
    from regexp_split_to_table(lower(coalesce(q, '')), '[^[:alnum:]]+') as t
    where t <> ''
  ) s;
$$;
grant execute on function private.prefix_tsquery(text) to anon, authenticated, service_role;

create function public.browse_media(
  p_q text default null,
  p_kind public.media_kind default null,
  p_genre text default null,
  p_sort text default 'newest',
  p_offset integer default 0,
  p_limit integer default 24
)
returns table (
  id uuid, kind public.media_kind, slug text, title text, release_year smallint, cover_url text,
  uses_ai integer, no_ai integer, unsure integer, counted_total integer, created_at timestamptz,
  genres text[]
)
language sql stable security invoker set search_path = '' as $$
  with q as (select private.prefix_tsquery(left(p_q, 200)) as tsq)
  select m.id, m.kind, m.slug, m.title, m.release_year, m.cover_url,
         coalesce(t.uses_ai, 0), coalesce(t.no_ai, 0), coalesce(t.unsure, 0), coalesce(t.counted_total, 0),
         m.created_at,
         array(select g.slug from public.media_genres mg join public.genres g on g.id = mg.genre_id
               where mg.media_id = m.id order by g.name)
  from public.media m
  left join public.vote_tallies t on t.media_id = m.id
  cross join q
  where m.status = 'published'
    and m.merged_into is null
    and (p_kind is null or m.kind = p_kind)
    and (p_genre is null or exists (
          select 1 from public.media_genres mg join public.genres g on g.id = mg.genre_id
          where mg.media_id = m.id and g.slug = p_genre))
    and (q.tsq is null or m.search @@ q.tsq)
  order by
    case when q.tsq is not null and p_sort = 'relevance' then ts_rank(m.search, q.tsq) end desc nulls last,
    case when p_sort = 'most_voted' then coalesce(t.counted_total, 0) end desc nulls last,
    -- Most disputed: many votes split evenly between "uses AI" and "no AI".
    case when p_sort = 'most_disputed' then
      least(coalesce(t.uses_ai, 0), coalesce(t.no_ai, 0))::float8 * 2
      - abs(coalesce(t.uses_ai, 0) - coalesce(t.no_ai, 0)) * 0.1
    end desc nulls last,
    m.created_at desc,
    m.id desc
  offset greatest(0, least(coalesce(p_offset, 0), 2000))
  limit greatest(1, least(coalesce(p_limit, 24), 50));
$$;
grant execute on function public.browse_media(text, public.media_kind, text, text, integer, integer)
  to anon, authenticated, service_role;

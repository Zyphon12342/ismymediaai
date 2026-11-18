-- Related titles for internal links: shared directors, creators, authors and
-- top-billed cast count most, then shared genres. Published titles only.
create function public.related_media(p_media uuid, p_limit integer default 6)
returns table (
  id uuid, slug text, title text, release_year smallint, kind public.media_kind, cover_url text,
  shared_people text[], shared_genres integer
)
language sql stable security invoker set search_path = '' as $$
  with src_people as (
    select c.contributor_id, c.role
    from public.credits c
    where c.media_id = p_media
      and (c.role in ('director', 'creator', 'author', 'showrunner', 'writer')
           or (c.role = 'actor' and coalesce(c.billing_order, 99) < 5))
  ),
  src_genres as (select genre_id from public.media_genres where media_id = p_media),
  people_hits as (
    select c.media_id, array_agg(distinct x.name order by x.name) as names, count(distinct c.contributor_id) as n
    from public.credits c
    join src_people s on s.contributor_id = c.contributor_id
    join public.contributors x on x.id = c.contributor_id
    where c.media_id <> p_media
    group by c.media_id
  ),
  genre_hits as (
    select g.media_id, count(*) as n
    from public.media_genres g
    join src_genres s on s.genre_id = g.genre_id
    where g.media_id <> p_media
    group by g.media_id
  ),
  scored as (
    select coalesce(p.media_id, g.media_id) as media_id,
           coalesce(p.names, '{}') as names,
           coalesce(p.n, 0) * 3 + coalesce(g.n, 0) as score,
           coalesce(g.n, 0)::int as genres
    from people_hits p
    full join genre_hits g on g.media_id = p.media_id
  )
  select m.id, m.slug, m.title, m.release_year, m.kind, m.cover_url, s.names, s.genres
  from scored s
  join public.media m on m.id = s.media_id
  where m.status = 'published' and m.merged_into is null
  order by s.score desc,
           (m.kind = (select kind from public.media where id = p_media)) desc,
           m.created_at desc
  limit least(greatest(p_limit, 1), 24);
$$;
grant execute on function public.related_media(uuid, integer) to anon, authenticated, service_role;

-- Published titles for the sitemap, most recently changed first.
create function public.sitemap_media(p_offset integer default 0, p_limit integer default 5000)
returns table (slug text, updated_at timestamptz)
language sql stable security invoker set search_path = '' as $$
  select m.slug, greatest(m.updated_at, coalesce(t.updated_at, m.updated_at))
  from public.media m
  left join public.vote_tallies t on t.media_id = m.id
  where m.status = 'published' and m.merged_into is null
  order by m.created_at, m.id
  offset greatest(p_offset, 0)
  limit least(greatest(p_limit, 1), 50000);
$$;
grant execute on function public.sitemap_media(integer, integer) to anon, authenticated, service_role;

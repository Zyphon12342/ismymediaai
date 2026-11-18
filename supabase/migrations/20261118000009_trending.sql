-- "New and trending" on the home page. The seed job (service role) rewrites
-- this list from TMDB now-playing and trending titles and Open Library's
-- trending books. Readers only see published, unmerged titles.

create table public.trending_media (
  media_id uuid primary key references public.media (id) on delete cascade,
  rank smallint not null check (rank between 1 and 1000),
  reason text not null check (reason in ('new', 'trending')),
  refreshed_at timestamptz not null default now()
);

alter table public.trending_media enable row level security;
revoke all on public.trending_media from anon, authenticated, public;
grant select on public.trending_media to anon, authenticated;
grant all on public.trending_media to service_role;

create policy trending_media_select on public.trending_media
  for select to anon, authenticated using (true);

-- Cards for the home page row, in list order. When the list is empty (a new
-- environment, or before the first refresh) it falls back to the most recent
-- releases, so the row is never blank.
create function public.trending_cards(
  p_kind public.media_kind default null,
  p_limit integer default 12
)
returns table (
  id uuid, kind public.media_kind, slug text, title text, release_year smallint, cover_url text,
  uses_ai integer, no_ai integer, unsure integer, counted_total integer, reason text,
  genres text[]
)
language sql stable security invoker set search_path = '' as $$
  with listed as (
    select tm.media_id, tm.rank::integer as rank, tm.reason
    from public.trending_media tm
    join public.media m on m.id = tm.media_id
    where m.status = 'published' and m.merged_into is null
      and (p_kind is null or m.kind = p_kind)
  ),
  fallback as (
    select m.id as media_id,
           (row_number() over (order by m.release_year desc nulls last, m.created_at desc, m.id))::integer as rank,
           'new'::text as reason
    from public.media m
    where not exists (select 1 from listed)
      and m.status = 'published' and m.merged_into is null
      and (p_kind is null or m.kind = p_kind)
      and m.release_year <= extract(year from now())::integer
    order by m.release_year desc nulls last, m.created_at desc, m.id
    limit 50
  ),
  picked as (select * from listed union all select * from fallback)
  select m.id, m.kind, m.slug, m.title, m.release_year, m.cover_url,
         coalesce(t.uses_ai, 0), coalesce(t.no_ai, 0), coalesce(t.unsure, 0), coalesce(t.counted_total, 0),
         p.reason,
         array(select g.slug from public.media_genres mg join public.genres g on g.id = mg.genre_id
               where mg.media_id = m.id order by g.name)
  from picked p
  join public.media m on m.id = p.media_id
  left join public.vote_tallies t on t.media_id = m.id
  order by p.rank, m.id
  limit greatest(1, least(coalesce(p_limit, 12), 48));
$$;
grant execute on function public.trending_cards(public.media_kind, integer) to anon, authenticated, service_role;

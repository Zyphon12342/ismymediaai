begin;
\ir _helpers.psql
select plan(6);

select tests.create_media('seed-film');
select tests.create_media('same-director');
select tests.create_media('same-genre');
select tests.create_media('unrelated');
select tests.create_media('hidden-film', 'movie', 'hidden');

insert into public.contributors (name, kind, source, external_id) values ('Dee Rector', 'person', 'tmdb', 'p1'), ('Extra Person', 'person', 'tmdb', 'p2');
insert into public.credits (media_id, contributor_id, role, billing_order)
select m.id, c.id, 'director', null
from public.media m, public.contributors c
where m.slug in ('seed-film', 'same-director', 'hidden-film') and c.external_id = 'p1';
-- An extra far down the cast list does not make titles related.
insert into public.credits (media_id, contributor_id, role, billing_order)
select m.id, c.id, 'actor', 40
from public.media m, public.contributors c
where m.slug in ('seed-film', 'unrelated') and c.external_id = 'p2';
insert into public.media_genres (media_id, genre_id)
select m.id, (select id from public.genres where slug = 'drama')
from public.media m where m.slug in ('seed-film', 'same-genre', 'same-director');

select tests.as_anon();
select is(
  (select array_agg(slug order by ord) from (
     select slug, row_number() over () as ord from public.related_media((select id from public.media where slug = 'seed-film'))
   ) r),
  array['same-director', 'same-genre'],
  'shared directors rank above shared genres; unrelated and hidden titles are left out');
select is(
  (select shared_people from public.related_media((select id from public.media where slug = 'seed-film')) where slug = 'same-director'),
  array['Dee Rector'], 'related titles name the shared people');
select is(
  (select shared_genres from public.related_media((select id from public.media where slug = 'seed-film')) where slug = 'same-director'),
  1, 'and count shared genres');
select is((select count(*)::int from public.related_media((select id from public.media where slug = 'seed-film'), 1)), 1, 'the limit applies');

select ok(
  (select bool_and(slug <> 'hidden-film') from public.sitemap_media()),
  'the sitemap lists only published titles');
select ok(
  (select count(*) from public.sitemap_media() where slug = 'seed-film') = 1,
  'published titles are in the sitemap');

select * from finish();
rollback;

begin;
\ir _helpers.psql
select plan(7);

select tests.create_media('old-film');
update public.media set release_year = 1990 where slug = 'old-film';
select tests.create_media('new-film');
update public.media set release_year = 2025 where slug = 'new-film';
select tests.create_media('new-book', 'book');
update public.media set release_year = 2024 where slug = 'new-book';
select tests.create_media('hidden-film', 'movie', 'hidden');
update public.media set release_year = 2025 where slug = 'hidden-film';

select tests.as_anon();
select is(
  (select array_agg(slug order by ord) from (
     select slug, row_number() over () as ord from public.trending_cards()) x
   where slug in ('new-film', 'new-book', 'old-film')),
  array['new-film', 'new-book', 'old-film'],
  'with no list, the row falls back to the newest releases');
select is(
  (select count(*)::int from public.trending_cards() where slug = 'hidden-film'), 0,
  'hidden titles never appear');

reset role;
insert into public.trending_media (media_id, rank, reason) values
  ((select id from public.media where slug = 'old-film'), 1, 'trending'),
  ((select id from public.media where slug = 'hidden-film'), 2, 'new'),
  ((select id from public.media where slug = 'new-book'), 3, 'trending');

select tests.as_anon();
select is(
  (select array_agg(slug) from public.trending_cards()),
  array['old-film', 'new-book'],
  'the list sets the order and hidden titles are skipped');
select is(
  (select array_agg(slug) from public.trending_cards('book')),
  array['new-book'],
  'filters by kind');
select is((select reason from public.trending_cards() limit 1), 'trending', 'returns why a title is listed');

select throws_ok(
  $$ insert into public.trending_media (media_id, rank, reason) values ((select id from public.media where slug = 'new-film'), 9, 'new') $$,
  '42501', null, 'visitors cannot change the list');
select tests.authenticate_as(tests.create_user('trend_user'));
select throws_ok(
  $$ delete from public.trending_media $$,
  '42501', null, 'members cannot change the list');

select * from finish();
rollback;

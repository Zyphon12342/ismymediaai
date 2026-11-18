begin;
\ir _helpers.psql
select plan(14);

select tests.create_media('an-anime', 'anime');
select tests.create_media('a-manga', 'manga');
select tests.create_media('twin-show', 'tv_show');
select tests.create_media('twin-anime', 'anime');
select tests.create_media('twin-book', 'book');
select tests.create_media('hidden-twin', 'tv_show', 'hidden');
update public.media set title = 'Attack on Titan', original_title = '進撃の巨人' where slug = 'twin-show';
update public.media set title = 'Attack on Titan' where slug = 'hidden-twin';
select tests.create_user('anime_mod', true, 1::smallint, 'moderator');
select tests.create_user('anime_fan');

-- Credit roles
insert into public.contributors (name, kind, source) values ('A Voice', 'person', 'manual'), ('A Studio', 'company', 'manual'), ('A Mangaka', 'person', 'manual');
select lives_ok(
  $$ insert into public.credits (media_id, contributor_id, role, character_name)
     select (select id from public.media where slug = 'an-anime'), id, 'actor', 'Hero' from public.contributors where name = 'A Voice' $$,
  'anime credits voice actors');
select lives_ok(
  $$ insert into public.credits (media_id, contributor_id, role)
     select (select id from public.media where slug = 'an-anime'), id, 'studio' from public.contributors where name = 'A Studio' $$,
  'anime credits studios');
select throws_ok(
  $$ insert into public.credits (media_id, contributor_id, role)
     select (select id from public.media where slug = 'an-anime'), id, 'author' from public.contributors where name = 'A Mangaka' $$,
  '23514', 'role author is not allowed on a anime', 'anime has no authors');
select lives_ok(
  $$ insert into public.credits (media_id, contributor_id, role)
     select (select id from public.media where slug = 'a-manga'), id, r::public.credit_role from public.contributors, unnest(array['author', 'illustrator']) r
     where name = 'A Mangaka' $$,
  'manga credits an author who is also the illustrator');
select throws_ok(
  $$ insert into public.credits (media_id, contributor_id, role)
     select (select id from public.media where slug = 'a-manga'), id, 'actor' from public.contributors where name = 'A Voice' $$,
  '23514', 'role actor is not allowed on a manga', 'manga has no actors');

-- Genres
select lives_ok(
  $$ insert into public.media_genres (media_id, genre_id)
     select (select id from public.media where slug = 'an-anime'), id from public.genres where slug in ('mecha', 'slice-of-life', 'action') $$,
  'anime takes shared and anime genres');
select throws_ok(
  $$ insert into public.media_genres (media_id, genre_id)
     select (select id from public.media where slug = 'a-manga'), id from public.genres where slug = 'documentary' $$,
  '23514', 'genre does not apply to a manga', 'manga cannot be a documentary');
select is(
  (select array_agg(slug order by slug) from public.genres where 'anime' = any (kinds) and 'manga' = any (kinds) and slug in ('mecha', 'sports', 'psychological', 'slice-of-life')),
  array['mecha', 'psychological', 'slice-of-life', 'sports'], 'the new genres apply to anime and manga');

-- Spotting twins: by title or original title, any case, published and unmerged only.
select tests.authenticate_as((select id from public.profiles where handle = 'anime_fan'));
select is(
  (select array_agg(slug) from public.similar_titles('{tv_show,movie}', array['attack ON titan'])),
  array['twin-show'], 'a twin is found by title, ignoring case and hidden titles');
select is(
  (select array_agg(slug) from public.similar_titles('{tv_show,movie}', array['Shingeki no Kyojin', '進撃の巨人'])),
  array['twin-show'], 'a twin is found by original title');
select is(
  (select count(*)::int from public.similar_titles('{anime}', array['Attack on Titan'])),
  0, 'only the asked kinds are searched');
reset role;
select tests.clear_claims();
select ok(not has_function_privilege('anon', 'public.similar_titles(public.media_kind[], text[])', 'execute'),
  'visitors who are not signed in cannot call similar_titles');

-- Merging twins across catalogues
select tests.authenticate_as((select id from public.profiles where handle = 'anime_mod'));
select lives_ok(
  $$ select public.merge_media((select id from public.media where slug = 'twin-show'), (select id from public.media where slug = 'twin-anime'), 'Same anime') $$,
  'a TV show merges into its anime twin');
select throws_ok(
  $$ select public.merge_media((select id from public.media where slug = 'twin-book'), (select id from public.media where slug = 'twin-anime')) $$,
  '22023', 'both titles must be the same kind, or anime with a TV show or film, or manga with a book', 'a book cannot merge into an anime');

select * from finish();
rollback;

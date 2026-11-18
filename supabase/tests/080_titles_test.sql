begin;
\ir _helpers.psql
select plan(16);

select tests.create_user('maker', true, 1::smallint);
select tests.create_user('newbie', true, 0::smallint);
select tests.authenticate_as((select id from public.profiles where handle = 'maker'));

select is(
  (select row(slug, status, existing)::text from public.create_media($j${
    "kind": "movie", "source": "tmdb", "external_id": "9001", "slug": "the-test-picture-2030",
    "title": "The Test Picture", "release_year": 2030, "genres": ["drama", "sci-fi"],
    "credits": [
      {"name": "Pat Example", "kind": "person", "external_id": "p1", "role": "director"},
      {"name": "Sam Example", "kind": "person", "external_id": "p2", "role": "actor", "character_name": "Lead", "billing_order": 0},
      {"name": "Example Studio", "kind": "company", "external_id": "c1", "role": "studio"}
    ]}$j$::jsonb)),
  '(the-test-picture-2030,published,f)',
  'a catalogue title is created and published at once'
);
select is(
  (select count(*)::int from public.credits c join public.media m on m.id = c.media_id where m.slug = 'the-test-picture-2030'),
  3, 'its credits are created');
select is(
  (select array_agg(g.slug order by g.slug) from public.media_genres mg join public.genres g on g.id = mg.genre_id
     join public.media m on m.id = mg.media_id where m.slug = 'the-test-picture-2030'),
  array['drama', 'sci-fi'], 'its genres are attached');
select is(
  (select created_by from public.media where slug = 'the-test-picture-2030'),
  (select id from public.profiles where handle = 'maker'), 'the creator is recorded');

select is(
  (select row(slug, existing)::text from public.create_media(
     '{"kind":"movie","source":"tmdb","external_id":"9001","slug":"other","title":"Again","genres":["drama"]}'::jsonb)),
  '(the-test-picture-2030,t)',
  'adding the same catalogue title again returns the existing one'
);

select is(
  (select row(slug, status)::text from public.create_media(
     '{"kind":"book","source":"manual","slug":"the-test-picture-2030","title":"Same Name","genres":["poetry"],
       "credits":[{"name":"A. Writer","kind":"person","role":"author"}]}'::jsonb)),
  '(the-test-picture-2030-2,pending)',
  'a manual entry gets a free slug and waits for review'
);

select throws_ok(
  $$ select * from public.create_media('{"kind":"movie","source":"tmdb","external_id":"9002","slug":"no-genres","title":"X","genres":[]}'::jsonb) $$,
  '23514', 'pick 1 to 3 genres', 'at least one genre is required');
select throws_ok(
  $$ select * from public.create_media('{"kind":"movie","source":"tmdb","external_id":"9003","slug":"bad-genre","title":"X","genres":["poetry"]}'::jsonb) $$,
  '23514', null, 'genres must fit the kind');
select throws_ok(
  $$ select * from public.create_media('{"kind":"book","source":"openlibrary","external_id":"OL1W","slug":"bad-role","title":"X","genres":["poetry"],
       "credits":[{"name":"D","kind":"person","external_id":"d1","role":"director"}]}'::jsonb) $$,
  '23514', null, 'credit roles must fit the kind');
select throws_ok(
  $$ select * from public.create_media('{"kind":"movie","source":"tmdb","external_id":"9004","slug":"Bad Slug","title":"X","genres":["drama"]}'::jsonb) $$,
  '23514', 'invalid slug', 'slugs are validated');

-- Rate limit: 5 titles a day. Two were created above.
select lives_ok(
  $$ select * from public.create_media('{"kind":"movie","source":"tmdb","external_id":"9010","slug":"r-three","title":"R3","genres":["drama"]}'::jsonb);
     select * from public.create_media('{"kind":"movie","source":"tmdb","external_id":"9011","slug":"r-four","title":"R4","genres":["drama"]}'::jsonb);
     select * from public.create_media('{"kind":"movie","source":"tmdb","external_id":"9012","slug":"r-five","title":"R5","genres":["drama"]}'::jsonb) $$,
  'five titles a day are allowed');
select throws_ok(
  $$ select * from public.create_media('{"kind":"movie","source":"tmdb","external_id":"9013","slug":"r-six","title":"R6","genres":["drama"]}'::jsonb) $$,
  'RL429', null, 'the sixth title in a day is rate limited');

select tests.authenticate_as((select id from public.profiles where handle = 'newbie'));
select throws_ok(
  $$ select * from public.create_media('{"kind":"movie","source":"tmdb","external_id":"9020","slug":"newbie-pic","title":"N","genres":["drama"]}'::jsonb) $$,
  '42501', null, 'trust level 0 cannot add titles');

-- Browse
select tests.as_anon();
select ok(
  (select count(*) from public.browse_media(p_q => 'test pic')) = 1,
  'prefix search finds a published title');
select is(
  (select count(*)::int from public.browse_media(p_q => 'same name')),
  0, 'pending titles are not listed');
select is(
  (select count(*)::int from public.browse_media(p_kind => 'movie', p_genre => 'sci-fi')),
  1, 'kind and genre filters apply');

select * from finish();
rollback;

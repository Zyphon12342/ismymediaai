begin;
\ir _helpers.psql
select plan(9);

select tests.create_user('newbie', true, 0::smallint);
select tests.create_user('member', true, 1::smallint);
select tests.create_user('trusted', true, 2::smallint);
select tests.create_user('unverified', false, 1::smallint);
select tests.create_user('mod', true, 2::smallint, 'moderator');
select tests.create_media('hidden-film', 'movie', 'hidden');
select tests.create_media('public-film');

select tests.as_anon();
select is(
  (select array_agg(slug order by slug) from public.media where slug in ('hidden-film', 'public-film')),
  array['public-film'],
  'anonymous visitors see only published titles'
);
reset role;

select tests.authenticate_as((select id from public.profiles where handle = 'newbie'));
select throws_ok(
  $$ insert into public.media (kind, slug, title, source, external_id) values ('movie', 'newbie-film', 'Newbie', 'tmdb', 'n1') $$,
  '42501', null,
  'trust level 0 cannot add titles'
);
reset role;

select tests.authenticate_as((select id from public.profiles where handle = 'unverified'));
select throws_ok(
  $$ insert into public.media (kind, slug, title, source, external_id) values ('movie', 'unverified-film', 'U', 'tmdb', 'u1') $$,
  '42501', null,
  'unverified accounts cannot add titles'
);
reset role;

select tests.authenticate_as((select id from public.profiles where handle = 'member'));
insert into public.media (kind, slug, title, source, external_id) values ('movie', 'catalogue-film', 'Catalogue', 'tmdb', 'c1');
insert into public.media (kind, slug, title, source) values ('book', 'manual-book', 'Manual', 'manual');
select is(
  (select status from public.media where slug = 'catalogue-film'),
  'published'::public.content_status,
  'catalogue entries publish immediately'
);
select is(
  (select status from public.media where slug = 'manual-book'),
  'pending'::public.content_status,
  'manual entries from trust level 1 wait for review'
);
select is(
  (select created_by from public.media where slug = 'manual-book'),
  (select id from public.profiles where handle = 'member'),
  'created_by is stamped with the caller'
);
update public.media set title = 'Renamed' where slug = 'catalogue-film';
select is(
  (select title from public.media where slug = 'catalogue-film'),
  'Catalogue',
  'regular users cannot edit titles'
);
reset role;

select tests.authenticate_as((select id from public.profiles where handle = 'trusted'));
insert into public.media (kind, slug, title, source) values ('book', 'trusted-book', 'Trusted', 'manual');
select is(
  (select status from public.media where slug = 'trusted-book'),
  'published'::public.content_status,
  'manual entries from trust level 2 publish immediately'
);
reset role;

select tests.authenticate_as((select id from public.profiles where handle = 'mod'));
update public.media set status = 'published' where slug = 'manual-book';
reset role;
select is(
  (select status from public.media where slug = 'manual-book'),
  'published'::public.content_status,
  'moderators can approve pending titles'
);

select * from finish();
rollback;

begin;
\ir _helpers.psql
select plan(7);

select tests.create_user('creator', true, 1::smallint);
select tests.create_user('stranger', true, 1::smallint);

select tests.authenticate_as((select id from public.profiles where handle = 'creator'));
insert into public.media (kind, slug, title, source, external_id) values ('book', 'a-book', 'A Book', 'openlibrary', 'OL1W');
insert into public.contributors (name, kind, source, external_id) values ('Sample Author', 'person', 'openlibrary', 'OL1A');
insert into public.contributors (name, kind, source, external_id) values ('Sample Press', 'company', 'openlibrary', 'OLP1');

select lives_ok(
  $$ insert into public.credits (media_id, contributor_id, role)
     values ((select id from public.media where slug = 'a-book'), (select id from public.contributors where external_id = 'OL1A'), 'author') $$,
  'the creator can add an author to their book'
);
select throws_ok(
  $$ insert into public.credits (media_id, contributor_id, role)
     values ((select id from public.media where slug = 'a-book'), (select id from public.contributors where external_id = 'OL1A'), 'director') $$,
  '23514', 'role director is not allowed on a book',
  'no director on a book'
);
select throws_ok(
  $$ insert into public.credits (media_id, contributor_id, role)
     values ((select id from public.media where slug = 'a-book'), (select id from public.contributors where external_id = 'OL1A'), 'publisher') $$,
  '23514', null,
  'a publisher credit must be a company'
);

insert into public.media_genres (media_id, genre_id)
  select (select id from public.media where slug = 'a-book'), id from public.genres where slug in ('drama', 'poetry', 'history');
select throws_ok(
  $$ insert into public.media_genres (media_id, genre_id)
     select (select id from public.media where slug = 'a-book'), id from public.genres where slug = 'romance' $$,
  '23514', 'a title can have at most 3 genres',
  'at most 3 genres per title'
);
delete from public.media_genres where genre_id = (select id from public.genres where slug = 'history');
select throws_ok(
  $$ insert into public.media_genres (media_id, genre_id)
     select (select id from public.media where slug = 'a-book'), id from public.genres where slug = 'animation' $$,
  '23514', 'genre does not apply to a book',
  'genres must fit the title''s kind'
);
reset role;

select tests.authenticate_as((select id from public.profiles where handle = 'stranger'));
select throws_ok(
  $$ insert into public.media_genres (media_id, genre_id)
     select (select id from public.media where slug = 'a-book'), id from public.genres where slug = 'mystery' $$,
  '42501', null,
  'only the creator or a moderator edits a title''s genres'
);
select throws_ok(
  $$ insert into public.genres (slug, name, kinds) values ('western', 'Western', '{movie}') $$,
  '42501', null,
  'only admins change the genre list'
);
reset role;

select * from finish();
rollback;

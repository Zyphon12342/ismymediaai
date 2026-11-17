begin;
\ir _helpers.psql
select plan(11);

select tests.create_user('author', true, 0::smallint);
select tests.create_user('other', true, 1::smallint);
select tests.create_user('unverified', false, 1::smallint);
select tests.create_user('mod', true, 2::smallint, 'moderator');
select tests.create_media('film');
select tests.create_media('locked-film');
update public.media set comments_locked = true where slug = 'locked-film';

\set film '(select id from public.media where slug = ''film'')'

select tests.authenticate_as((select id from public.profiles where handle = 'author'));
select lives_ok(
  $$ insert into public.comments (media_id, body, evidence_url, ai_areas)
     values ((select id from public.media where slug = 'film'), 'Credits list an AI vendor.', 'https://example.test/credits', '{visuals}') $$,
  'a verified user can comment, even at trust level 0'
);
select throws_ok(
  $$ insert into public.comments (media_id, body, evidence_url)
     values ((select id from public.media where slug = 'film'), 'x', 'http://insecure.test') $$,
  '23514', null,
  'evidence links must be https'
);
select throws_ok(
  $$ insert into public.comments (media_id, body) values ((select id from public.media where slug = 'locked-film'), 'hi') $$,
  '42501', null,
  'nobody comments on a locked title'
);
reset role;

select tests.authenticate_as((select id from public.profiles where handle = 'other'));
insert into public.comments (media_id, parent_id, body)
  values (:film, (select id from public.comments where body like 'Credits%'), 'Source?');
select throws_ok(
  $$ insert into public.comments (media_id, parent_id, body)
     values ((select id from public.media where slug = 'film'), (select id from public.comments where body = 'Source?'), 'Nested') $$,
  '23514', 'replies can only be one level deep',
  'replies are one level deep'
);
update public.comments set body = 'Edited by someone else' where body like 'Credits%';
select is(
  (select count(*)::int from public.comments where body = 'Edited by someone else'),
  0,
  'users cannot edit others'' comments'
);
reset role;

select tests.authenticate_as((select id from public.profiles where handle = 'unverified'));
select throws_ok(
  $$ insert into public.comments (media_id, body) values ((select id from public.media where slug = 'film'), 'hi') $$,
  '42501', null,
  'unverified accounts cannot comment'
);
reset role;

select tests.authenticate_as((select id from public.profiles where handle = 'author'));
select lives_ok(
  $$ update public.comments set body = 'Credits list an AI vendor (edited).' where body like 'Credits%' $$,
  'authors can edit within 15 minutes'
);
select throws_ok(
  $$ update public.comments set status = 'hidden' where body like 'Credits%' $$,
  '42501', 'only moderators can change comment status',
  'authors cannot change moderation status'
);
reset role;
select tests.clear_claims();

update public.comments set created_at = now() - interval '16 minutes' where body like 'Credits%';
select tests.authenticate_as((select id from public.profiles where handle = 'author'));
select throws_ok(
  $$ update public.comments set body = 'Too late' where body like 'Credits%' $$,
  '23514', 'comments can only be edited for 15 minutes',
  'edits close after 15 minutes'
);
update public.comments set deleted_at = now() where body like 'Credits%';
select is(
  (select body from public.comments where user_id = auth.uid()),
  '',
  'soft delete keeps the row but clears its text'
);
reset role;

select tests.authenticate_as((select id from public.profiles where handle = 'mod'));
update public.comments set status = 'hidden' where body = 'Source?';
reset role;
select tests.as_anon();
select is(
  (select count(*)::int from public.comments where body = 'Source?'),
  0,
  'hidden comments are not public'
);
reset role;

select * from finish();
rollback;

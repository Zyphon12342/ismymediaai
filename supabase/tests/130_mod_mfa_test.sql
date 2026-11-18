begin;
\ir _helpers.psql
select plan(7);

select tests.create_media('mfa-film');
select tests.create_user('mfa_writer');
select tests.create_user('mfa_reporter');
select tests.create_user('mfa_mod', true, 1::smallint, 'moderator');
select tests.create_user('mfa_boss', true, 2::smallint, 'admin');

select tests.authenticate_as((select id from public.profiles where handle = 'mfa_writer'));
insert into public.comments (media_id, body) values ((select id from public.media where slug = 'mfa-film'), 'needs review');
select tests.authenticate_as((select id from public.profiles where handle = 'mfa_reporter'));
insert into public.reports (target_type, target_id, reason) select 'comment', id, 'spam' from public.comments where body = 'needs review';

-- A moderator whose session skipped 2-step login is treated as a member.
select tests.authenticate_as((select id from public.profiles where handle = 'mfa_mod'), 'aal1');
select throws_ok(
  $$ select public.moderate('hide', 'comment', (select id from public.comments where body = 'needs review')) $$,
  '42501', 'moderators only', 'a moderator without 2-step login cannot moderate');
select is((select count(*)::int from public.mod_actions), 0, 'nor read the moderation log');
select is(
  (select count(*)::int from public.reports), 0, 'nor read other people''s reports');

select tests.authenticate_as((select id from public.profiles where handle = 'mfa_boss'), 'aal1');
select throws_ok(
  $$ select public.moderate('set_role', 'profile', (select id from public.profiles where handle = 'mfa_writer'), null, 1) $$,
  '42501', null, 'an admin without 2-step login cannot change roles');

-- The same accounts after 2-step login.
select tests.authenticate_as((select id from public.profiles where handle = 'mfa_mod'), 'aal2');
select lives_ok(
  $$ select public.moderate('hide', 'comment', (select id from public.comments where body = 'needs review')) $$,
  'with 2-step login the moderator can moderate');
reset role;
select is((select status::text from public.comments where body = 'needs review'), 'hidden', 'the hide is applied');

select tests.authenticate_as((select id from public.profiles where handle = 'mfa_boss'), 'aal2');
select lives_ok(
  $$ select public.moderate('set_role', 'profile', (select id from public.profiles where handle = 'mfa_writer'), null, 1) $$,
  'with 2-step login the admin can change roles');

select * from finish();
rollback;

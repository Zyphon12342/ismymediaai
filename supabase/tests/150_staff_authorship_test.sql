begin;
\ir _helpers.psql
select plan(6);

select tests.create_media('staff-film');
select tests.create_user('staff_member');
select tests.create_user('staff_mod', true, 1::smallint, 'moderator');
select tests.create_user('staff_boss', true, 2::smallint, 'admin');

select tests.authenticate_as((select id from public.profiles where handle = 'staff_member'));
insert into public.comments (media_id, body) values ((select id from public.media where slug = 'staff-film'), 'member says');

-- Staff with 2-step login comment and report like anyone else, under their own name.
select tests.authenticate_as((select id from public.profiles where handle = 'staff_boss'), 'aal2');
select lives_ok(
  $$ insert into public.comments (media_id, body) values ((select id from public.media where slug = 'staff-film'), 'admin says') $$,
  'an admin with 2-step login can comment');
select tests.authenticate_as((select id from public.profiles where handle = 'staff_mod'), 'aal2');
select lives_ok(
  $$ insert into public.comments (media_id, body) values ((select id from public.media where slug = 'staff-film'), 'mod says') $$,
  'a moderator with 2-step login can comment');
select lives_ok(
  $$ insert into public.reports (target_type, target_id, reason) select 'comment', id, 'spam' from public.comments where body = 'member says' $$,
  'a moderator with 2-step login can report');
-- Without 2-step login staff are members, and that already worked.
select tests.authenticate_as((select id from public.profiles where handle = 'staff_boss'), 'aal1');
select lives_ok(
  $$ insert into public.comments (media_id, body) values ((select id from public.media where slug = 'staff-film'), 'admin aal1 says') $$,
  'an admin without 2-step login can comment');

reset role;
select is(
  (select p.handle::text from public.comments c join public.profiles p on p.id = c.user_id where c.body = 'admin says'),
  'staff_boss', 'the admin is the comment''s author');
select is(
  (select p.handle::text from public.reports r join public.profiles p on p.id = r.reporter_id),
  'staff_mod', 'the moderator is the reporter');

select * from finish();
rollback;

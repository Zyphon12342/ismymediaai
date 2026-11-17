begin;
\ir _helpers.psql
select plan(8);

select tests.create_user('reporter', true, 1::smallint);
select tests.create_user('other', true, 1::smallint);
select tests.create_user('mod', true, 2::smallint, 'moderator');
select tests.create_user('admin', true, 2::smallint, 'admin');
select tests.create_media('film');

select tests.authenticate_as((select id from public.profiles where handle = 'reporter'));
insert into public.reports (target_type, target_id, reason) values ('media', (select id from public.media where slug = 'film'), 'wrong_details');
select throws_ok(
  $$ insert into public.reports (target_type, target_id, reason) values ('media', (select id from public.media where slug = 'film'), 'spam') $$,
  '23505', null,
  'one open report per reporter per target'
);
select throws_ok(
  $$ insert into public.mod_actions (action, target_type, target_id) values ('hide', 'media', gen_random_uuid()) $$,
  '42501', null,
  'regular users cannot write to the moderation log'
);
reset role;

select tests.authenticate_as((select id from public.profiles where handle = 'other'));
select is((select count(*)::int from public.reports), 0, 'users see only their own reports');
reset role;

select tests.authenticate_as((select id from public.profiles where handle = 'mod'));
select is((select count(*)::int from public.reports), 1, 'moderators see all reports');
select lives_ok(
  $$ insert into public.mod_actions (action, target_type, target_id, reason) values ('hide', 'media', (select id from public.media where slug = 'film'), 'test') $$,
  'moderators append to the moderation log'
);
reset role;

select tests.authenticate_as((select id from public.profiles where handle = 'admin'));
select throws_ok(
  $$ update public.mod_actions set reason = 'rewritten' $$,
  '42501', null,
  'admins cannot edit the moderation log'
);
reset role;
select tests.clear_claims();

select throws_ok(
  $$ update public.mod_actions set reason = 'rewritten' $$,
  '42501', 'mod_actions is append-only',
  'even the database owner cannot edit the moderation log'
);
select throws_ok(
  $$ delete from public.mod_actions $$,
  '42501', 'mod_actions is append-only',
  'even the database owner cannot delete from the moderation log'
);

select * from finish();
rollback;

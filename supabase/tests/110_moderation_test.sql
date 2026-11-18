begin;
\ir _helpers.psql
select plan(20);

select tests.create_media('mod-film');
select tests.create_user('writer');
select tests.create_user('rep1');
select tests.create_user('rep2');
select tests.create_user('rep3');
select tests.create_user('newbie', true, 0::smallint);
select tests.create_user('trusted', true, 2::smallint);
select tests.create_user('modder', true, 1::smallint, 'moderator');
select tests.create_user('other_mod', true, 1::smallint, 'moderator');
select tests.create_user('boss', true, 2::smallint, 'admin');

select tests.authenticate_as((select id from public.profiles where handle = 'writer'));
insert into public.comments (media_id, body) values ((select id from public.media where slug = 'mod-film'), 'first');
insert into public.comments (media_id, body) values ((select id from public.media where slug = 'mod-film'), 'second');
select throws_ok(
  $$ insert into public.reports (target_type, target_id, reason)
     select 'comment', id, 'spam' from public.comments where body = 'first' $$,
  'P0002', 'nothing to report', 'you cannot report your own comment');
select throws_ok(
  $$ insert into public.reports (target_type, target_id, reason) values ('media', gen_random_uuid(), 'spam') $$,
  'P0002', 'nothing to report', 'reports need a real target');

-- Auto-hide: trust 0 reports do not count; three trust 1 reports hide.
select tests.authenticate_as((select id from public.profiles where handle = 'newbie'));
insert into public.reports (target_type, target_id, reason) select 'comment', id, 'spam' from public.comments where body = 'first';
select tests.authenticate_as((select id from public.profiles where handle = 'rep1'));
insert into public.reports (target_type, target_id, reason) select 'comment', id, 'spam' from public.comments where body = 'first';
select tests.authenticate_as((select id from public.profiles where handle = 'rep2'));
insert into public.reports (target_type, target_id, reason) select 'comment', id, 'spam' from public.comments where body = 'first';
reset role;
select is((select status::text from public.comments where body = 'first'), 'published', 'two counted reports do not hide a comment');
select tests.authenticate_as((select id from public.profiles where handle = 'rep3'));
insert into public.reports (target_type, target_id, reason) select 'comment', id, 'harassment' from public.comments where body = 'first';
reset role;
select is((select status::text from public.comments where body = 'first'), 'hidden', 'three counted reports hide a comment');
select is(
  (select count(*)::int from public.mod_actions where action = 'hide' and actor_id is null),
  1, 'the automatic hide is logged with no actor');

select tests.authenticate_as((select id from public.profiles where handle = 'trusted'));
insert into public.reports (target_type, target_id, reason) select 'comment', id, 'spam' from public.comments where body = 'second';
reset role;
select is((select status::text from public.comments where body = 'second'), 'hidden', 'one report from a trust 2 user hides a comment');

-- Only moderators call moderate().
select tests.authenticate_as((select id from public.profiles where handle = 'rep1'));
select throws_ok(
  $$ select public.moderate('hide', 'media', (select id from public.media where slug = 'mod-film')) $$,
  '42501', 'moderators only', 'regular users cannot moderate');

select tests.authenticate_as((select id from public.profiles where handle = 'modder'));
select lives_ok(
  $$ select public.moderate('restore', 'comment', (select id from public.comments where body = 'first'), 'Fine on review') $$,
  'a moderator restores a comment');
reset role;
select is((select status::text from public.comments where body = 'first'), 'published', 'restore publishes the comment');
select is(
  (select count(*)::int from public.reports r join public.comments c on c.id = r.target_id
   where c.body = 'first' and r.status = 'dismissed' and r.handled_by is not null),
  4, 'restoring closes the open reports as dismissed');

select tests.authenticate_as((select id from public.profiles where handle = 'modder'));
select lives_ok(
  $$ select public.moderate('lock_comments', 'media', (select id from public.media where slug = 'mod-film'), null, 1) $$,
  'a moderator locks comments on a title');
select lives_ok(
  $$ select public.moderate('ban', 'profile', (select id from public.profiles where handle = 'writer'), 'Spam', 7) $$,
  'a moderator bans a user for 7 days');
select lives_ok(
  $$ select public.moderate('set_trust', 'profile', (select id from public.profiles where handle = 'rep1'), null, 2) $$,
  'a moderator sets trust');
select throws_ok(
  $$ select public.moderate('ban', 'profile', (select id from public.profiles where handle = 'other_mod')) $$,
  '42501', 'only admins can moderate moderators', 'moderators cannot ban moderators');
select throws_ok(
  $$ select public.moderate('set_role', 'profile', (select id from public.profiles where handle = 'rep2'), null, 1) $$,
  '42501', 'only admins can change roles', 'moderators cannot change roles');
select throws_ok(
  $$ select public.moderate('set_trust', 'profile', (select id from public.profiles where handle = 'rep1'), null, 5) $$,
  '22023', null, 'trust levels are 0 to 2');
reset role;
select is(
  (select row(m.comments_locked, w.banned_until > now() + interval '6 days', r1.trust_level)::text
   from public.media m, public.profiles w, public.profiles r1
   where m.slug = 'mod-film' and w.handle = 'writer' and r1.handle = 'rep1'),
  '(t,t,2)', 'lock, ban and trust changes are applied');
select is(
  (select count(*)::int from public.mod_actions where actor_id = (select id from public.profiles where handle = 'modder')),
  4, 'every moderator action is logged');

select tests.authenticate_as((select id from public.profiles where handle = 'boss'));
select lives_ok(
  $$ select public.moderate('set_role', 'profile', (select id from public.profiles where handle = 'rep2'), 'New mod', 1) $$,
  'admins change roles');
reset role;
select is((select role::text from public.profiles where handle = 'rep2'), 'moderator', 'the role is applied');

select * from finish();
rollback;

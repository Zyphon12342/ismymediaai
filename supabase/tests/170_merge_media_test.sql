begin;
\ir _helpers.psql
select plan(14);

select tests.create_media('dup-keep');
select tests.create_media('dup-gone');
select tests.create_media('dup-old');
select tests.create_media('dup-book', 'book');
select tests.create_user('merge_mod', true, 1::smallint, 'moderator');
select tests.create_user('both_voter');
select tests.create_user('gone_voter');
select tests.create_user('commenter');
select tests.create_user('dup_reporter');

-- both_voter voted on both entries; gone_voter only on the duplicate.
insert into public.votes (user_id, media_id, value)
select p.id, m.id, v.val::public.vote_value
from (values ('both_voter', 'dup-keep', 'no_ai'), ('both_voter', 'dup-gone', 'uses_ai'), ('gone_voter', 'dup-gone', 'uses_ai')) as v (h, s, val)
join public.profiles p on p.handle = v.h
join public.media m on m.slug = v.s;

select tests.authenticate_as((select id from public.profiles where handle = 'commenter'));
insert into public.comments (media_id, body) select id, 'on the duplicate' from public.media where slug = 'dup-gone';
select tests.authenticate_as((select id from public.profiles where handle = 'dup_reporter'));
insert into public.reports (target_type, target_id, reason) select 'media', id, 'duplicate' from public.media where slug = 'dup-gone';

-- Only moderators merge.
select throws_ok(
  $$ select public.merge_media((select id from public.media where slug = 'dup-gone'), (select id from public.media where slug = 'dup-keep')) $$,
  '42501', 'moderators only', 'members cannot merge');

select tests.authenticate_as((select id from public.profiles where handle = 'merge_mod'));
select throws_ok(
  $$ select public.merge_media((select id from public.media where slug = 'dup-keep'), (select id from public.media where slug = 'dup-keep')) $$,
  '22023', 'a title cannot be merged into itself', 'a title cannot merge into itself');
select throws_ok(
  $$ select public.merge_media((select id from public.media where slug = 'dup-gone'), (select id from public.media where slug = 'dup-book')) $$,
  '22023', 'both titles must be the same kind', 'a film cannot merge into a book');
select lives_ok(
  $$ select public.merge_media((select id from public.media where slug = 'dup-gone'), (select id from public.media where slug = 'dup-keep'), 'Same film') $$,
  'a moderator merges a duplicate');

reset role;
select tests.clear_claims();
select is(
  (select merged_into from public.media where slug = 'dup-gone'),
  (select id from public.media where slug = 'dup-keep'),
  'the duplicate points at the survivor');
select is(
  (select count(*)::int from public.votes v join public.media m on m.id = v.media_id where m.slug = 'dup-gone'),
  0, 'no votes are left on the duplicate');
select is(
  (select value::text from public.votes v join public.media m on m.id = v.media_id join public.profiles p on p.id = v.user_id
   where m.slug = 'dup-keep' and p.handle = 'both_voter'),
  'no_ai', 'a member who voted on both keeps their vote on the survivor');
select is(
  (select (uses_ai, no_ai)::text from public.vote_tallies t join public.media m on m.id = t.media_id where m.slug = 'dup-keep'),
  '(1,1)', 'the survivor''s tally includes the moved vote');
select is(
  (select counted_total from public.vote_tallies t join public.media m on m.id = t.media_id where m.slug = 'dup-gone'),
  0, 'the duplicate''s tally is empty');
select is(
  (select m.slug from public.comments c join public.media m on m.id = c.media_id where c.body = 'on the duplicate'),
  'dup-keep', 'comments move to the survivor');
select is(
  (select r.status::text from public.reports r join public.media m on m.id = r.target_id where m.slug = 'dup-gone'),
  'actioned', 'open reports on the duplicate are closed');
select is(
  (select reason from public.mod_actions a join public.media m on m.id = a.target_id where a.action = 'merge' and m.slug = 'dup-gone'),
  'Merged into dup-keep: Same film', 'the merge is logged with the survivor');

-- A later merge of the survivor carries earlier duplicates along, and a
-- merged title cannot be merged again.
select tests.authenticate_as((select id from public.profiles where handle = 'merge_mod'));
select public.merge_media((select id from public.media where slug = 'dup-keep'), (select id from public.media where slug = 'dup-old'));
select throws_ok(
  $$ select public.merge_media((select id from public.media where slug = 'dup-gone'), (select id from public.media where slug = 'dup-old')) $$,
  '22023', 'that title was already merged', 'a merged title cannot be merged again');
reset role;
select is(
  (select merged_into from public.media where slug = 'dup-gone'),
  (select id from public.media where slug = 'dup-old'),
  'earlier merges follow to the new survivor');

select * from finish();
rollback;

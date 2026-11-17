begin;
\ir _helpers.psql
select plan(12);

select tests.create_user('voter', true, 1::smallint);
select tests.create_user('newbie', true, 0::smallint);
select tests.create_user('public_voter', true, 1::smallint);
select tests.create_user('unverified', false, 1::smallint);
update public.profiles set show_votes = true where handle = 'public_voter';
select tests.create_media('film');
select tests.create_media('pending-film', 'movie', 'pending');

\set film '(select id from public.media where slug = ''film'')'

select is(
  (select counted_total from public.vote_tallies where media_id = :film),
  0,
  'a new title starts with an empty tally'
);

select tests.authenticate_as((select id from public.profiles where handle = 'voter'));
insert into public.votes (media_id, value) values (:film, 'uses_ai');
select is(
  (select uses_ai from public.vote_tallies where media_id = :film),
  1,
  'a trust level 1 vote is counted'
);
select throws_ok(
  $$ insert into public.votes (media_id, value) values ((select id from public.media where slug = 'film'), 'no_ai') $$,
  '23505', null,
  'one vote per user per title'
);
update public.votes set value = 'no_ai' where media_id = :film;
select is(
  (select array[uses_ai, no_ai, unsure] from public.vote_tallies where media_id = :film),
  array[0, 1, 0],
  'changing a vote moves it in the tally'
);
select throws_ok(
  $$ insert into public.votes (media_id, value) values ((select id from public.media where slug = 'pending-film'), 'no_ai') $$,
  '42501', null,
  'nobody can vote on an unpublished title'
);
reset role;

select tests.authenticate_as((select id from public.profiles where handle = 'newbie'));
insert into public.votes (media_id, value) values (:film, 'uses_ai');
select is(
  (select counted_total from public.vote_tallies where media_id = :film),
  1,
  'a trust level 0 vote is stored but not counted'
);
select is(
  (select count(*)::int from public.votes),
  1,
  'a user reads only their own private votes'
);
reset role;

select tests.authenticate_as((select id from public.profiles where handle = 'public_voter'));
insert into public.votes (media_id, value) values (:film, 'unsure');
reset role;

select tests.as_anon();
select is(
  (select array_agg(p.handle) from public.votes v join public.profiles p on p.id = v.user_id),
  array['public_voter'],
  'anonymous visitors see only votes of users who turned on show_votes'
);
reset role;

select tests.authenticate_as((select id from public.profiles where handle = 'unverified'));
select throws_ok(
  $$ insert into public.votes (media_id, value) values ((select id from public.media where slug = 'film'), 'no_ai') $$,
  '42501', null,
  'unverified accounts cannot vote'
);
reset role;
select tests.clear_claims();

update public.profiles set trust_level = 1 where handle = 'newbie';
select is(
  (select counted_total from public.vote_tallies where media_id = :film),
  3,
  'reaching trust level 1 makes earlier votes count'
);

update public.profiles set banned_until = now() + interval '7 days' where handle = 'voter';
select is(
  (select array[uses_ai, no_ai, unsure] from public.vote_tallies where media_id = :film),
  array[1, 0, 1],
  'a ban drops the account''s votes from the tally'
);

select tests.authenticate_as((select id from public.profiles where handle = 'newbie'));
delete from public.votes where media_id = :film;
reset role;
select is(
  (select counted_total from public.vote_tallies where media_id = :film),
  1,
  'withdrawing a vote updates the tally'
);

select * from finish();
rollback;

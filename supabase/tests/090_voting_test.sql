begin;
\ir _helpers.psql
select plan(7);

select tests.create_media('vote-film');
select tests.create_media('pending-film', 'movie', 'pending');
select tests.create_user('caster');
select tests.create_user('unverified_voter', false);

select tests.authenticate_as((select id from public.profiles where handle = 'caster'));
select is(public.cast_vote((select id from public.media where slug = 'vote-film'), 'uses_ai'), 'uses_ai'::public.vote_value, 'cast_vote sets a vote');
select is(public.cast_vote((select id from public.media where slug = 'vote-film'), 'no_ai'), 'no_ai'::public.vote_value, 'cast_vote changes it');
select is((select count(*)::int from public.votes where user_id = auth.uid()), 1, 'one vote per user per title');
select is(
  (select row(uses_ai, no_ai)::text from public.vote_tallies where media_id = (select id from public.media where slug = 'vote-film')),
  '(0,1)', 'the tally follows the change');
select throws_ok(
  $$ select public.cast_vote((select id from public.media where slug = 'pending-film'), 'uses_ai') $$,
  '42501', null, 'cannot vote on unpublished titles');

select lives_ok(
  $$ do $d$ begin for i in 1..14 loop
       perform public.cast_vote((select id from public.media where slug = 'vote-film'), case when i % 2 = 0 then 'uses_ai'::public.vote_value else 'no_ai' end);
     end loop; end $d$ $$,
  'many changes within the limit are fine');

select tests.authenticate_as((select id from public.profiles where handle = 'unverified_voter'));
select throws_ok(
  $$ select public.cast_vote((select id from public.media where slug = 'vote-film'), 'uses_ai') $$,
  '42501', null, 'unverified accounts cannot vote');

select * from finish();
rollback;

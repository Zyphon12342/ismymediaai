begin;
\ir _helpers.psql
select plan(9);

select tests.create_media('spike-film');
select tests.create_media('steady-film');
select tests.create_media('popular-film');
select tests.create_user('spike_mod', true, 1::smallint, 'moderator');
select tests.create_user('spike_member');

-- 25 brand-new accounts pile onto spike-film; 25 old accounts onto steady-film.
do $$
declare
  i integer;
  u uuid;
begin
  for i in 1..25 loop
    u := tests.create_user('spike_new_' || i);
    insert into public.votes (user_id, media_id, value) select u, id, 'uses_ai' from public.media where slug = 'spike-film';
    u := tests.create_user('spike_old_' || i);
    update public.profiles set created_at = now() - interval '90 days' where id = u;
    insert into public.votes (user_id, media_id, value) select u, id, 'no_ai' from public.media where slug = 'steady-film';
  end loop;
  -- popular-film normally gets ~10 votes an hour, so 25 new ones is no spike.
  for i in 1..1500 loop
    u := tests.create_user('spike_fan_' || i);
    update public.profiles set created_at = now() - interval '90 days' where id = u;
    insert into public.votes (user_id, media_id, value, created_at, updated_at)
    select u, id, 'no_ai', now() - interval '2 days', now() - interval '2 days' from public.media where slug = 'popular-film';
  end loop;
  for i in 1..25 loop
    u := tests.create_user('spike_pop_' || i);
    insert into public.votes (user_id, media_id, value) select u, id, 'uses_ai' from public.media where slug = 'popular-film';
  end loop;
end $$;

select is(private.check_vote_spikes(), 1, 'one title is flagged');
select ok(
  (select under_review from public.vote_tallies t join public.media m on m.id = t.media_id where m.slug = 'spike-film'),
  'the spiking title is under review');
select is(
  (select count(*)::int from public.reports r join public.media m on m.id = r.target_id
   where m.slug = 'spike-film' and r.reason = 'vote_spike' and r.status = 'open' and r.reporter_id is null),
  1, 'and waits in the moderator queue');
select is(
  (select count(*)::int from public.vote_tallies t join public.media m on m.id = t.media_id
   where m.slug in ('steady-film', 'popular-film') and t.under_review),
  0, 'votes from established accounts, or at a title''s normal rate, are not a spike');
select is(private.check_vote_spikes(), 0, 'a flagged title is not reported twice');

select tests.authenticate_as((select id from public.profiles where handle = 'spike_member'));
select throws_ok(
  $$ insert into public.reports (target_type, target_id, reason) select 'media', id, 'vote_spike' from public.media where slug = 'steady-film' $$,
  '42501', 'that reason is reserved', 'members cannot file vote spike reports');
select throws_ok(
  $$ select private.check_vote_spikes() $$,
  '42501', null, 'nor run the check');

select tests.authenticate_as((select id from public.profiles where handle = 'spike_mod'));
select lives_ok(
  $$ select public.moderate('dismiss_report', 'media', (select id from public.media where slug = 'spike-film'), 'checked, real interest') $$,
  'a moderator clears the report');
reset role;
select ok(
  not (select under_review from public.vote_tallies t join public.media m on m.id = t.media_id where m.slug = 'spike-film'),
  'which clears the flag');

select * from finish();
rollback;

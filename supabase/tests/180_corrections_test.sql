begin;
\ir _helpers.psql
select plan(13);

select tests.create_media('fix-film');
select tests.create_media('fix-hidden', 'movie', 'hidden');
select tests.create_user('fix_mod', true, 1::smallint, 'moderator');
select tests.create_user('fix_member');

-- Signed out: anyone can file a request on a published title.
select tests.as_anon();
select lives_ok(
  $$ select public.request_correction((select id from public.media where slug = 'fix-film'),
       'Studio Legal', 'Legal@Studio.example', 'rights_holder', 'No generative AI was used in this film.', 'https://studio.example/statement') $$,
  'a signed-out rights holder files a request');
select throws_ok(
  $$ select public.request_correction((select id from public.media where slug = 'fix-hidden'), 'A', 'a@b.example', 'other', 'Please check this title.') $$,
  'P0002', 'no such title', 'hidden titles cannot get requests');
select throws_ok(
  $$ select public.request_correction((select id from public.media where slug = 'fix-film'), 'A', 'not-an-email', 'other', 'Please check this title.') $$,
  '23514', null, 'the email must look like an email');
select throws_ok(
  $$ select count(*) from public.correction_requests $$,
  '42501', null, 'signed-out visitors cannot read requests');

-- Five a day per email address.
do $$
begin
  for i in 1..4 loop
    perform public.request_correction((select id from public.media where slug = 'fix-film'),
      'Studio Legal', 'legal@studio.example', 'rights_holder', 'Another note number ' || i);
  end loop;
end $$;
select throws_ok(
  $$ select public.request_correction((select id from public.media where slug = 'fix-film'), 'Studio Legal', 'LEGAL@studio.example', 'rights_holder', 'One too many requests') $$,
  'RL429', 'rate limit exceeded: correction', 'the sixth request from one email in a day is refused');

-- Members can file but not read.
select tests.authenticate_as((select id from public.profiles where handle = 'fix_member'));
select lives_ok(
  $$ select public.request_correction((select id from public.media where slug = 'fix-film'), 'Member', 'm@example.test', 'other', 'The year is wrong here.') $$,
  'a member files a request');
select is((select count(*)::int from public.correction_requests), 0, 'members see no requests');
select throws_ok(
  $$ select public.handle_correction((select id from public.correction_requests limit 1), 'resolved') $$,
  '42501', 'moderators only', 'members cannot close requests');

-- Moderators read and close them.
select tests.authenticate_as((select id from public.profiles where handle = 'fix_mod'));
select is((select count(*)::int from public.correction_requests where status = 'open'), 6, 'moderators see open requests');
select is(
  (select requester_id from public.correction_requests where email = 'm@example.test'),
  (select id from public.profiles where handle = 'fix_member'), 'a member''s request records who sent it');
select lives_ok(
  $$ select public.handle_correction((select id from public.correction_requests where email = 'm@example.test'), 'resolved', 'Fixed the year') $$,
  'a moderator resolves a request');
select throws_ok(
  $$ select public.handle_correction((select id from public.correction_requests where email = 'm@example.test'), 'declined') $$,
  'P0002', 'no open request', 'a closed request cannot be closed again');
reset role;
select tests.clear_claims();
select is(
  (select reason from public.mod_actions where action = 'handle_correction'),
  'Correction request resolved: Fixed the year', 'closing a request is logged');

select * from finish();
rollback;

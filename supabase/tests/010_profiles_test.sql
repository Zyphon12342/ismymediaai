begin;
\ir _helpers.psql
select plan(8);

select tests.create_user('alice');
select tests.create_user('bob');

select is(
  (select count(*)::int from public.profiles where handle in ('alice', 'bob')),
  2,
  'a profile is created for every new auth user'
);

select tests.authenticate_as((select id from public.profiles where handle = 'alice'));

select lives_ok(
  $$ update public.profiles set display_name = 'Alice A', show_votes = true where handle = 'alice' $$,
  'a user can edit their own display name and show_votes'
);

update public.profiles set display_name = 'Hacked' where handle = 'bob';
select is(
  (select display_name from public.profiles where handle = 'bob'),
  null,
  'a user cannot edit someone else''s profile'
);

select throws_ok(
  $$ update public.profiles set role = 'admin' where handle = 'alice' $$,
  '42501', null,
  'a user cannot make themselves an admin'
);

select throws_ok(
  $$ update public.profiles set trust_level = 2 where handle = 'alice' $$,
  '42501', null,
  'a user cannot raise their own trust level'
);

select throws_ok(
  $$ select trust_level from public.profiles where handle = 'bob' $$,
  '42501', null,
  'trust levels are not publicly readable'
);

select is(
  (select trust_level from public.my_profile()),
  1::smallint,
  'my_profile() returns the caller''s private fields'
);

update public.profiles set handle = 'alice_two' where handle = 'alice';
select throws_ok(
  $$ update public.profiles set handle = 'alice_three' where handle = 'alice_two' $$,
  '23514', 'handle can be changed once every 30 days',
  'handles change at most once every 30 days'
);

select * from finish();
rollback;

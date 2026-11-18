begin;
\ir _helpers.psql
select plan(19);

-- Sign-up keeps a valid, free username from the sign-up form.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_user_meta_data, created_at, updated_at)
values ('a1000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000', 'authenticated',
        'authenticated', 'carol@example.test', '', '{"handle": "Carol_K", "full_name": "Carol K"}', now(), now());
select is(
  (select handle || '|' || display_name from public.profiles where id = 'a1000000-0000-0000-0000-000000000000'),
  'carol_k|Carol K',
  'sign-up keeps the chosen username (lower-cased) and the provider name'
);

-- A taken or reserved username falls back to a placeholder.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_user_meta_data, created_at, updated_at)
values ('a2000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000', 'authenticated',
        'authenticated', 'carol2@example.test', '', '{"handle": "carol_k"}', now(), now()),
       ('a3000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000', 'authenticated',
        'authenticated', 'admin@example.test', '', '{"handle": "admin"}', now(), now());
select is(
  (select handle from public.profiles where id = 'a2000000-0000-0000-0000-000000000000'),
  'user_a20000000000',
  'a taken username falls back to a placeholder'
);
select ok(
  (select handle from public.profiles where id = 'a3000000-0000-0000-0000-000000000000') like 'user\_%',
  'a reserved username falls back to a placeholder'
);

-- handle_available()
select tests.as_anon();
select ok(public.handle_available('fresh_name'), 'a free username is available');
select ok(not public.handle_available('carol_k'), 'a taken username is not available');
select ok(not public.handle_available('settings'), 'a reserved username is not available');
select ok(not public.handle_available('user_0123456789ab'), 'placeholder-shaped usernames are reserved');
select ok(not public.handle_available('No Spaces'), 'an invalid username is not available');
select throws_ok(
  $$ select * from public.my_profile() $$,
  '42501', null,
  'anonymous visitors cannot call my_profile()'
);
select tests.clear_claims();
reset role;

-- Edits through the guard trigger.
select tests.create_user('dave');
select tests.authenticate_as((select id from public.profiles where handle = 'dave'));

select throws_ok(
  $$ update public.profiles set handle = 'moderator' where handle = 'dave' $$,
  '23514', 'that username is reserved',
  'users cannot take a reserved username'
);
select throws_ok(
  format($$ update public.profiles set avatar_path = '%s/x.webp' where handle = 'dave' $$,
         'a1000000-0000-0000-0000-000000000000'),
  '23514', 'avatar must be in your own folder',
  'avatar paths must be inside the user''s own folder'
);
select lives_ok(
  format($$ update public.profiles set avatar_path = '%s/a1b2.webp' where handle = 'dave' $$,
         (select id from public.profiles where handle = 'dave')),
  'a user can point their avatar at their own folder'
);
select throws_ok(
  $$ update public.profiles set display_name = E'bad\nname' where handle = 'dave' $$,
  '23514', 'display name has control characters',
  'display names cannot hold control characters'
);
select is(
  (select handle_changed_at from public.my_profile()),
  null,
  'my_profile() reports when the username last changed'
);

-- Profile stats are public.
select tests.as_anon();
select is(
  (select row(comment_count, vote_count, titles_added)::text
     from public.profile_stats((select id from public.profiles where handle = 'dave'))),
  '(0,0,0)',
  'anyone can read a profile''s counts'
);
select tests.clear_claims();
reset role;

-- Rate limit: 10 profile edits an hour, then RL429.
select tests.authenticate_as((select id from public.profiles where handle = 'dave'));
select lives_ok(
  $$ do $d$ begin
       for i in 1..8 loop  -- the avatar edit above was the first
         update public.profiles set display_name = 'Dave ' || i where handle = 'dave';
       end loop;
     end $d$ $$,
  'ten profile edits in an hour are allowed'
);
select lives_ok(
  $$ update public.profiles set display_name = 'Dave 10' where handle = 'dave' $$,
  'the tenth edit is allowed'
);
select throws_ok(
  $$ update public.profiles set display_name = 'Dave 11' where handle = 'dave' $$,
  'RL429', null,
  'the eleventh edit in an hour is rate limited'
);
select lives_ok(
  $$ update public.profiles set display_name = display_name where handle = 'dave' $$,
  'a no-op update does not count'
);

select * from finish();
rollback;

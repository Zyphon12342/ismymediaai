begin;
\ir _helpers.psql
select plan(14);

select tests.create_media('talk-film');
select tests.create_media('locked-film');
update public.media set comments_locked = true where slug = 'locked-film';
select tests.create_user('talker');
select tests.create_user('other_talker');
insert into private.blocked_terms (term) values ('badword');
insert into private.blocked_domains (domain) values ('malware.example');

select tests.authenticate_as((select id from public.profiles where handle = 'talker'));
select is(public.my_comment_count(), 0, 'a new user has no comments');

select lives_ok(
  $$ insert into public.comments (media_id, body, evidence_url, ai_areas)
     values ((select id from public.media where slug = 'talk-film'), 'The credits list an AI vendor.',
             'https://news.example/story', '{visuals}') $$,
  'a verified user can comment with evidence');
select is(public.my_comment_count(), 1, 'my_comment_count counts my comments');

select throws_ok(
  $$ insert into public.comments (media_id, body) values ((select id from public.media where slug = 'talk-film'), 'This is a BadWord here') $$,
  '23514', 'comment contains a blocked word', 'blocked words are refused, whatever the case');
select lives_ok(
  $$ insert into public.comments (media_id, body) values ((select id from public.media where slug = 'talk-film'), 'badwordy is not a whole-word match') $$,
  'blocked words match whole words only');
select throws_ok(
  $$ insert into public.comments (media_id, body, evidence_url) values ((select id from public.media where slug = 'talk-film'), 'see link', 'https://cdn.malware.example/x') $$,
  '23514', 'evidence link domain is blocked', 'links to blocked domains and their subdomains are refused');
select lives_ok(
  $$ insert into public.comments (media_id, body, evidence_url) values ((select id from public.media where slug = 'talk-film'), 'see link', 'https://notmalware.example/x') $$,
  'a domain that only ends with the same letters is allowed');
select throws_ok(
  $$ insert into public.comments (media_id, body) values ((select id from public.media where slug = 'locked-film'), 'hello') $$,
  '42501', null, 'nobody comments on a locked title');

-- Replies
select lives_ok(
  $$ insert into public.comments (media_id, parent_id, body)
     select media_id, id, 'Which vendor?' from public.comments where body like 'The credits%' $$,
  'a reply to a top-level comment is allowed');
select throws_ok(
  $$ insert into public.comments (media_id, parent_id, body)
     select media_id, id, 'Deeper' from public.comments where body = 'Which vendor?' $$,
  '23514', 'replies can only be one level deep', 'replies stay one level deep');

-- Edits and deletes
select lives_ok(
  $$ update public.comments set body = 'The end credits list an AI vendor.' where body like 'The credits%' $$,
  'the author can edit within 15 minutes');
select is(
  (select edited_at is not null from public.comments where body like 'The end credits%'), true, 'edits are marked');

select tests.authenticate_as((select id from public.profiles where handle = 'other_talker'));
update public.comments set body = 'hijack' where body like 'The end credits%';
reset role;
select is(
  (select count(*)::int from public.comments where body = 'hijack'), 0,
  'others cannot edit a comment (RLS hides it from the update)');
select tests.authenticate_as((select id from public.profiles where handle = 'other_talker'));

-- Rate limit: 10 comments an hour.
select throws_ok(
  $$ do $d$ begin for i in 1..11 loop
       insert into public.comments (media_id, body) values ((select id from public.media where slug = 'talk-film'), 'note ' || i);
     end loop; end $d$ $$,
  'RL429', null, 'the eleventh comment in an hour is rate limited');

select * from finish();
rollback;

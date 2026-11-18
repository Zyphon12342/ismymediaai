begin;
\ir _helpers.psql
select plan(5);

select is(
  (select count(*)::int from pg_tables where schemaname = 'public' and not rowsecurity),
  0,
  'RLS is enabled on every public table'
);

select tables_are('public', array[
  'profiles', 'media', 'contributors', 'credits', 'genres', 'media_genres',
  'votes', 'vote_tallies', 'comments', 'reports', 'mod_actions', 'trending_media'
], 'public schema has exactly the expected tables');

select is((select count(*)::int from public.genres), 20, 'the curated genre list is seeded');

select ok(
  not has_function_privilege('anon', 'public.refresh_trust_levels()', 'execute')
  and not has_function_privilege('authenticated', 'public.refresh_trust_levels()', 'execute'),
  'only the service role can run the trust level job'
);

select ok(
  not has_table_privilege('anon', 'public.votes', 'insert')
  and not has_table_privilege('anon', 'public.comments', 'insert')
  and not has_table_privilege('anon', 'public.media', 'insert'),
  'anonymous visitors cannot write'
);

select * from finish();
rollback;

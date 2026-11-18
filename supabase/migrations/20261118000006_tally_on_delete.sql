-- Deleting a title cascades to its votes, and each vote's delete trigger
-- recounted the tally, re-inserting a tally row for a title that no longer
-- exists (a foreign key error that blocked the delete). Skip titles that are
-- gone.
create or replace function private.recount_tally(m uuid) returns void
language sql security definer set search_path = '' as $$
  insert into public.vote_tallies as t (media_id, uses_ai, no_ai, unsure, updated_at)
  select
    m,
    count(*) filter (where v.value = 'uses_ai'),
    count(*) filter (where v.value = 'no_ai'),
    count(*) filter (where v.value = 'unsure'),
    now()
  from public.votes v
  join public.profiles p on p.id = v.user_id
  where v.media_id = m
    and p.trust_level >= 1
    and (p.banned_until is null or p.banned_until <= now())
  having exists (select 1 from public.media x where x.id = m)
  on conflict (media_id) do update set
    uses_ai = excluded.uses_ai,
    no_ai = excluded.no_ai,
    unsure = excluded.unsure,
    updated_at = excluded.updated_at;
$$;

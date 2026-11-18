-- Voting: 30 vote changes a minute per user, enforced in the database.
create function private.rate_limit_vote() returns trigger
language plpgsql as $$
begin
  perform private.rate_limit('vote', 30, interval '1 minute');
  return coalesce(new, old);
end;
$$;
grant execute on function private.rate_limit_vote() to authenticated, service_role;

create trigger votes_rate_limit before insert or update or delete on public.votes
  for each row execute function private.rate_limit_vote();

-- Upsert in one call: set or change the caller's vote on a title.
create function public.cast_vote(p_media uuid, p_value public.vote_value)
returns public.vote_value
language plpgsql security invoker set search_path = '' as $$
begin
  insert into public.votes (media_id, value) values (p_media, p_value)
  on conflict (user_id, media_id) do update set value = excluded.value
  where public.votes.value is distinct from excluded.value;
  return p_value;
end;
$$;
revoke all on function public.cast_vote(uuid, public.vote_value) from public, anon;
grant execute on function public.cast_vote(uuid, public.vote_value) to authenticated, service_role;

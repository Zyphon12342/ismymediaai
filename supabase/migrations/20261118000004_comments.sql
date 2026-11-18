-- Comments: rate limits, a word filter and a blocked-domain list for
-- evidence links, and a helper for the "Turnstile on your first 3 comments"
-- rule.

-- ---------------------------------------------------------------------------
-- Blocked terms and domains. Both start empty; admins add rows with the
-- service role (see docs/SETUP.md). Terms match whole words, case-insensitive.
-- ---------------------------------------------------------------------------
create table private.blocked_terms (
  term text primary key check (term = lower(term) and char_length(term) between 2 and 60 and term ~ '^[a-z0-9 ''-]+$')
);
create table private.blocked_domains (
  domain text primary key check (domain = lower(domain) and domain ~ '^[a-z0-9.-]+\.[a-z]{2,}$')
);
grant all on private.blocked_terms, private.blocked_domains to service_role;

create function private.has_blocked_term(body text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from private.blocked_terms t
    where lower(body) ~ ('(^|[^a-z0-9])' || t.term || '($|[^a-z0-9])')
  );
$$;

-- True when the link's host is a blocked domain or a subdomain of one.
create function private.has_blocked_domain(link text) returns boolean
language sql stable security definer set search_path = '' as $$
  select link is not null and exists (
    select 1 from private.blocked_domains d,
      lateral (select lower(substring(link from '^https://([^/:?#]+)')) as host) h
    where h.host = d.domain or right(h.host, char_length(d.domain) + 1) = '.' || d.domain
  );
$$;

revoke all on function private.has_blocked_term(text), private.has_blocked_domain(text) from public;
grant execute on function private.has_blocked_term(text), private.has_blocked_domain(text)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Content checks and rate limits: 10 new comments an hour, 20 edits or
-- deletes an hour. Moderators and the service role are not limited.
-- ---------------------------------------------------------------------------
create function private.check_comment_write() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    perform private.rate_limit('comment', 10, interval '1 hour');
  elsif new.body is distinct from old.body
     or new.evidence_url is distinct from old.evidence_url
     or new.ai_areas is distinct from old.ai_areas
     or new.deleted_at is distinct from old.deleted_at then
    perform private.rate_limit('comment_edit', 20, interval '1 hour');
    -- Authors cannot edit on a locked title; deleting is still allowed.
    if new.deleted_at is null and auth.uid() is not null and not private.is_moderator()
       and not private.comments_open(new.media_id) then
      raise exception 'comments are locked on this title' using errcode = 'insufficient_privilege';
    end if;
  else
    return new;
  end if;
  if new.deleted_at is null and private.has_blocked_term(new.body) then
    raise exception 'comment contains a blocked word' using errcode = '23514';
  end if;
  if private.has_blocked_domain(new.evidence_url) then
    raise exception 'evidence link domain is blocked' using errcode = '23514';
  end if;
  return new;
end;
$$;
grant execute on function private.check_comment_write() to authenticated, service_role;

-- Runs after the prepare/guard triggers (names sort after "comments_guard_"
-- and "comments_prepare_"), so it sees the final row.
create trigger comments_write_checks before insert or update on public.comments
  for each row execute function private.check_comment_write();

-- ---------------------------------------------------------------------------
-- How many comments the caller has ever posted, including deleted ones, so
-- deleting does not reset the Turnstile rule.
-- ---------------------------------------------------------------------------
create function public.my_comment_count() returns integer
language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.comments where user_id = auth.uid();
$$;
revoke all on function public.my_comment_count() from public, anon;
grant execute on function public.my_comment_count() to authenticated, service_role;

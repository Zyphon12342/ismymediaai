-- Correction requests: anyone (rights holders included, signed in or not)
-- can ask for a title's details, a claim or its verdict to be reviewed. The
-- request carries a contact email so a moderator can reply. Only moderators
-- read requests; writes go through the two functions below.

create table public.correction_requests (
  id uuid primary key default gen_random_uuid(),
  media_id uuid not null references public.media (id) on delete cascade,
  requester_id uuid references public.profiles (id) on delete set null,
  name text not null check (char_length(name) between 1 and 200),
  email text not null check (char_length(email) <= 320 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  relationship text not null check (relationship in ('rights_holder', 'creator', 'representative', 'other')),
  message text not null check (char_length(message) between 10 and 4000),
  evidence_url text check (evidence_url is null or (evidence_url ~ '^https://' and char_length(evidence_url) <= 2000)),
  status text not null default 'open' check (status in ('open', 'resolved', 'declined')),
  resolution_note text check (resolution_note is null or char_length(resolution_note) <= 1000),
  handled_by uuid references public.profiles (id) on delete set null,
  handled_at timestamptz,
  created_at timestamptz not null default now()
);
create index correction_requests_open_idx on public.correction_requests (status, created_at);
create index correction_requests_media_idx on public.correction_requests (media_id, created_at);
create index correction_requests_email_idx on public.correction_requests (lower(email), created_at);

alter table public.correction_requests enable row level security;
revoke all on public.correction_requests from anon, authenticated, public;
grant select on public.correction_requests to authenticated;
grant all on public.correction_requests to service_role;

create policy correction_requests_mod_select on public.correction_requests
  for select to authenticated using (private.is_moderator());

-- File a request. Signed-in members get 5 a day; signed-out requests are
-- limited per email address and per title (the API also requires Turnstile).
create function public.request_correction(
  p_media uuid,
  p_name text,
  p_email text,
  p_relationship text,
  p_message text,
  p_evidence_url text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  rid uuid;
  addr text := lower(trim(p_email));
begin
  if not exists (select 1 from public.media m where m.id = p_media and m.status = 'published') then
    raise exception 'no such title' using errcode = 'P0002';
  end if;
  perform private.rate_limit('correction', 5, interval '1 day');
  if (select count(*) from public.correction_requests c
      where lower(c.email) = addr and c.created_at > now() - interval '1 day') >= 5
     or (select count(*) from public.correction_requests c
         where c.media_id = p_media and c.created_at > now() - interval '1 day') >= 20 then
    raise exception 'rate limit exceeded: correction' using errcode = 'RL429';
  end if;
  insert into public.correction_requests (media_id, requester_id, name, email, relationship, message, evidence_url)
  values (p_media, auth.uid(), trim(p_name), addr, p_relationship, trim(p_message), nullif(trim(p_evidence_url), ''))
  returning id into rid;
  return rid;
end;
$$;
revoke all on function public.request_correction(uuid, text, text, text, text, text) from public;
grant execute on function public.request_correction(uuid, text, text, text, text, text) to anon, authenticated;

-- Close a request as resolved or declined. Logged to mod_actions against the title.
create function public.handle_correction(p_id uuid, p_status text, p_note text default null)
returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  mid uuid;
  log_id bigint;
begin
  if me is null or not private.is_moderator() or not private.is_verified() then
    raise exception 'moderators only' using errcode = '42501';
  end if;
  if p_status not in ('resolved', 'declined') then
    raise exception 'status must be resolved or declined' using errcode = '22023';
  end if;
  if p_note is not null and char_length(p_note) > 1000 then
    raise exception 'reason is too long' using errcode = '22001';
  end if;
  perform private.rate_limit('moderate', 60, interval '1 minute');
  update public.correction_requests
  set status = p_status, resolution_note = nullif(trim(p_note), ''), handled_by = me, handled_at = now()
  where id = p_id and status = 'open'
  returning media_id into mid;
  if mid is null then
    raise exception 'no open request' using errcode = 'P0002';
  end if;
  insert into public.mod_actions (actor_id, action, target_type, target_id, reason)
  values (me, 'handle_correction', 'media', mid,
          'Correction request ' || p_status || coalesce(': ' || nullif(trim(p_note), ''), ''))
  returning id into log_id;
  return log_id;
end;
$$;
revoke all on function public.handle_correction(uuid, text, text) from public, anon;
grant execute on function public.handle_correction(uuid, text, text) to authenticated;

-- Contact details are kept only as long as needed: handled requests are
-- deleted a year after they were closed.
select cron.schedule(
  'prune-correction-requests',
  '30 4 * * *',
  $$ delete from public.correction_requests where status <> 'open' and handled_at < now() - interval '1 year'; $$
);

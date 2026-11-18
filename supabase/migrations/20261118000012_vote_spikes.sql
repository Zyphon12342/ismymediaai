-- Vote spike check (design doc, abuse rule 4): every 10 minutes, a title that
-- gets far more votes than its normal rate, mostly from new accounts, is
-- flagged. Its tally shows "under review" and it lands in the moderator
-- queue as a report. Handling that report (dismiss, hide, ...) clears the flag.

create function private.check_vote_spikes(
  p_window interval default interval '1 hour',
  p_min_votes integer default 20,
  p_factor numeric default 10,
  p_new_share numeric default 0.5,
  p_new_account_age interval default interval '7 days'
) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  s record;
  flagged integer := 0;
begin
  for s in
    with recent as (
      select v.media_id,
             count(*) as n,
             count(*) filter (where p.created_at > now() - p_new_account_age) as n_new
      from public.votes v
      join public.profiles p on p.id = v.user_id
      where greatest(v.created_at, v.updated_at) > now() - p_window
      group by v.media_id
    ),
    baseline as (
      -- Votes in the week before the window, per window-length slot.
      select v.media_id,
             count(*)::numeric / (extract(epoch from interval '7 days') / extract(epoch from p_window)) as per_window
      from public.votes v
      where greatest(v.created_at, v.updated_at) between now() - p_window - interval '7 days' and now() - p_window
      group by v.media_id
    )
    select r.media_id, r.n, r.n_new, coalesce(b.per_window, 0) as normal
    from recent r
    left join baseline b on b.media_id = r.media_id
    join public.vote_tallies t on t.media_id = r.media_id
    where r.n >= p_min_votes
      and r.n >= p_factor * greatest(coalesce(b.per_window, 0), 1)
      and r.n_new >= p_new_share * r.n
      and not t.under_review
  loop
    update public.vote_tallies set under_review = true where media_id = s.media_id;
    insert into public.reports (reporter_id, target_type, target_id, reason, note)
    values (
      null, 'media', s.media_id, 'vote_spike',
      format('%s votes in the last %s, %s%% from accounts under %s old (normally about %s).',
             s.n, p_window, round(100.0 * s.n_new / s.n), p_new_account_age, round(s.normal, 1))
    );
    flagged := flagged + 1;
  end loop;
  return flagged;
end;
$$;
revoke all on function private.check_vote_spikes(interval, integer, numeric, numeric, interval) from public, anon, authenticated;

select cron.schedule('check-vote-spikes', '*/10 * * * *', $$ select private.check_vote_spikes(); $$);

-- Only the check itself files vote spike reports.
create function private.guard_vote_spike_report() returns trigger
language plpgsql as $$
begin
  if new.reason = 'vote_spike' and auth.uid() is not null then
    raise exception 'that reason is reserved' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger reports_guard_vote_spike before insert on public.reports
  for each row execute function private.guard_vote_spike_report();

-- A moderator handling the last open spike report on a title clears its flag.
create function private.clear_vote_review() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.reports r
    where r.target_type = 'media' and r.target_id = new.target_id
      and r.reason = 'vote_spike' and r.status = 'open'
  ) then
    update public.vote_tallies set under_review = false where media_id = new.target_id;
  end if;
  return null;
end;
$$;
create trigger reports_clear_vote_review after update of status on public.reports
  for each row
  when (new.target_type = 'media' and new.reason = 'vote_spike' and old.status = 'open' and new.status <> 'open')
  execute function private.clear_vote_review();

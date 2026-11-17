-- Scheduled jobs run inside Postgres with pg_cron, so no deploy pipeline or
-- secret is needed to keep them going. Times are UTC.
create extension if not exists pg_cron;

-- Nightly: promote verified accounts older than 72 hours to trust level 1.
-- Their earlier votes start counting via the profiles_standing trigger.
select cron.schedule(
  'refresh-trust-levels',
  '15 3 * * *',
  $$ select public.refresh_trust_levels(); $$
);

-- A report reason only the automatic vote spike check may use. Kept in its
-- own migration because a new enum value cannot be used in the transaction
-- that adds it.
alter type public.report_reason add value if not exists 'vote_spike';

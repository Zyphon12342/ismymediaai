-- New moderator action for closing a correction request. Added on its own
-- because a new enum value cannot be used in the transaction that adds it.
alter type public.mod_action_type add value if not exists 'handle_correction';

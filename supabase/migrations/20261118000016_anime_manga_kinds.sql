-- Anime and manga as their own kinds of title, from AniList.
-- New enum values cannot be used in the transaction that adds them, so the
-- rules that use them are in the next migration.
alter type public.media_kind add value if not exists 'anime';
alter type public.media_kind add value if not exists 'manga';
alter type public.media_source add value if not exists 'anilist';

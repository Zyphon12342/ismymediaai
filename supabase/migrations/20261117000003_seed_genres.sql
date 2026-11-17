-- The curated genre list. Each genre lists the kinds of title it applies to,
-- so the browse filter only offers genres that fit the chosen kind.
-- Change this list only with a new migration.
insert into public.genres (slug, name, kinds) values
  ('action',      'Action',      '{movie,tv_show,book}'),
  ('comedy',      'Comedy',      '{movie,tv_show,book}'),
  ('drama',       'Drama',       '{movie,tv_show,book}'),
  ('horror',      'Horror',      '{movie,tv_show,book}'),
  ('sci-fi',      'Sci-fi',      '{movie,tv_show,book}'),
  ('fantasy',     'Fantasy',     '{movie,tv_show,book}'),
  ('romance',     'Romance',     '{movie,tv_show,book}'),
  ('thriller',    'Thriller',    '{movie,tv_show,book}'),
  ('mystery',     'Mystery',     '{movie,tv_show,book}'),
  ('crime',       'Crime',       '{movie,tv_show,book}'),
  ('animation',   'Animation',   '{movie,tv_show}'),
  ('documentary', 'Documentary', '{movie,tv_show}'),
  ('family',      'Family',      '{movie,tv_show}'),
  ('history',     'History',     '{movie,tv_show,book}'),
  ('biography',   'Biography',   '{movie,book}'),
  ('non-fiction', 'Non-fiction', '{book}'),
  ('young-adult', 'Young adult', '{book}'),
  ('childrens',   'Children''s', '{book}'),
  ('poetry',      'Poetry',      '{book}'),
  ('self-help',   'Self-help',   '{book}');

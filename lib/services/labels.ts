/** Display labels shared by pages. */
export const VOTE_LABELS = {
  uses_ai: "Uses gen AI",
  no_ai: "No gen AI",
  unsure: "Not sure",
} as const;

export const KIND_LABELS = {
  movie: "Movie",
  tv_show: "TV show",
  book: "Book",
  anime: "Anime",
  manga: "Manga",
} as const;

export const KIND_PLURALS = {
  movie: "Movies",
  tv_show: "TV shows",
  book: "Books",
  anime: "Anime",
  manga: "Manga",
} as const;

/** Display names of the catalogues titles come from. */
export const SOURCE_NAMES = {
  tmdb: "TMDB",
  openlibrary: "Open Library",
  anilist: "AniList",
} as const;

export function sourceName(source: string): string {
  return Object.hasOwn(SOURCE_NAMES, source) ? SOURCE_NAMES[source as keyof typeof SOURCE_NAMES] : source;
}

/** Path of a title's detail page. */
export function titlePath(slug: string): string {
  return `/titles/${slug}`;
}

export function profilePath(handle: string): string {
  return `/u/${handle}`;
}

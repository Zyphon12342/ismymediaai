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
} as const;

export const KIND_PLURALS = {
  movie: "Movies",
  tv_show: "TV shows",
  book: "Books",
} as const;

/** Path of a title's detail page. */
export function titlePath(slug: string): string {
  return `/titles/${slug}`;
}

export function profilePath(handle: string): string {
  return `/u/${handle}`;
}

/** Rules for seeding a new catalogue from TMDB and Open Library. Pure functions only. */
import type { LookupDetail } from "@/lib/catalog/types";

/** Genres that fit every kind, used when the catalogue gives none we know. */
export const FALLBACK_GENRE = "drama";

/** Up to 3 of the catalogue's genres, or the fallback. */
export function seedGenres(detail: Pick<LookupDetail, "genres">): string[] {
  const picked = [...new Set(detail.genres)].slice(0, 3);
  return picked.length ? picked : [FALLBACK_GENRE];
}

/** Whether a catalogue entry is worth seeding: it needs a title, a year and a cover. */
export function worthSeeding(detail: Pick<LookupDetail, "title" | "year" | "coverUrl">): boolean {
  return detail.title.trim().length > 0 && detail.year !== null && detail.coverUrl !== null;
}

export function parseCount(raw: string | undefined, fallback: number, max = 200): number {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? Math.min(n, max) : fallback;
}

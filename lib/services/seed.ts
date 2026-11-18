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

export type TrendingReason = "new" | "trending";

export interface TrendingEntry {
  mediaId: string;
  rank: number;
  reason: TrendingReason;
}

/**
 * Merge several lists (now playing, trending movies, trending TV, trending
 * books) into one ranked list, taking one from each in turn so the home row
 * mixes kinds. A title in more than one list keeps its first place.
 */
export function interleaveTrending(lists: { reason: TrendingReason; ids: string[] }[], max = 200): TrendingEntry[] {
  const seen = new Set<string>();
  const out: TrendingEntry[] = [];
  const longest = Math.max(0, ...lists.map((l) => l.ids.length));
  for (let i = 0; i < longest && out.length < max; i++) {
    for (const l of lists) {
      const id = l.ids[i];
      if (id === undefined || seen.has(id)) continue;
      seen.add(id);
      out.push({ mediaId: id, rank: out.length + 1, reason: l.reason });
      if (out.length >= max) break;
    }
  }
  return out;
}

/** Fewer than this many entries means a source was down; keep yesterday's list instead. */
export const MIN_TRENDING = 8;

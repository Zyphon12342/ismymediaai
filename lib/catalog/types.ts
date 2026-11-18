import type { Database } from "@/lib/database.types";

export type MediaKind = Database["public"]["Enums"]["media_kind"];
export type CreditRole = Database["public"]["Enums"]["credit_role"];
export type CatalogSource = "tmdb" | "openlibrary" | "anilist";

export interface CreditInput {
  name: string;
  kind: "person" | "company";
  role: CreditRole;
  /** Catalogue id such as "person/31" (TMDB) or "OL23919A" (Open Library); absent for manual credits. */
  externalId?: string;
  characterName?: string;
  billingOrder?: number;
}

export interface LookupResult {
  source: CatalogSource;
  externalId: string;
  kind: MediaKind;
  title: string;
  year: number | null;
  coverUrl: string | null;
  /** A short hint, e.g. the director or author. */
  byline: string | null;
  /** Other names for the work (original, romaji, native), used to spot the same work from another catalogue. */
  altTitles?: string[];
}

export interface LookupDetail extends LookupResult {
  originalTitle: string | null;
  synopsis: string | null;
  /** Our genre slugs, best guess from the catalogue's own genres or subjects. */
  genres: string[];
  credits: CreditInput[];
}

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export class CatalogError extends Error {
  constructor(
    message: string,
    readonly status = 502,
  ) {
    super(message);
  }
}

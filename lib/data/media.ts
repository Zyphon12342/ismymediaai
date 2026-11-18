import "server-only";
import type { Database } from "@/lib/database.types";
import { BROWSE_PAGE, decodeOffset, nextOffset } from "@/lib/services/media";
import type { DbClient } from "@/lib/supabase/server";
import type { BrowseQuery } from "@/lib/validation/media";

type MediaKind = Database["public"]["Enums"]["media_kind"];

export interface Genre {
  slug: string;
  name: string;
  kinds: MediaKind[];
}

export interface Tally {
  uses_ai: number;
  no_ai: number;
  unsure: number;
}

export interface MediaCard {
  id: string;
  kind: MediaKind;
  slug: string;
  title: string;
  year: number | null;
  coverUrl: string | null;
  tally: Tally;
  total: number;
  genres: string[];
}

export interface MediaCredit {
  role: Database["public"]["Enums"]["credit_role"];
  characterName: string | null;
  billingOrder: number | null;
  contributor: { id: string; name: string; kind: "person" | "company" };
}

export interface MediaDetail {
  id: string;
  kind: MediaKind;
  slug: string;
  title: string;
  originalTitle: string | null;
  year: number | null;
  synopsis: string | null;
  coverUrl: string | null;
  source: Database["public"]["Enums"]["media_source"];
  externalId: string | null;
  status: Database["public"]["Enums"]["content_status"];
  commentsLocked: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  mergedInto: string | null;
  tally: Tally & { total: number; underReview: boolean; updatedAt: string | null };
  genres: { slug: string; name: string }[];
  credits: MediaCredit[];
}

export async function listGenres(db: DbClient, kind?: MediaKind): Promise<Genre[]> {
  let q = db.from("genres").select("slug, name, kinds").order("name");
  if (kind) q = q.contains("kinds", [kind]);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function browseMedia(db: DbClient, query: BrowseQuery): Promise<{ items: MediaCard[]; nextCursor: string | null }> {
  const offset = decodeOffset(query.cursor);
  const sort = query.sort ?? (query.q ? "relevance" : "newest");
  const { data, error } = await db.rpc("browse_media", {
    p_q: query.q ?? undefined,
    p_kind: query.kind ?? undefined,
    p_genre: query.genre ?? undefined,
    p_sort: sort,
    p_offset: offset,
    p_limit: BROWSE_PAGE + 1,
  });
  if (error) throw error;
  const rows = data ?? [];
  return {
    items: rows.slice(0, BROWSE_PAGE).map((r) => ({
      id: r.id,
      kind: r.kind,
      slug: r.slug,
      title: r.title,
      year: r.release_year ?? null,
      coverUrl: r.cover_url ?? null,
      tally: { uses_ai: r.uses_ai, no_ai: r.no_ai, unsure: r.unsure },
      total: r.counted_total,
      genres: r.genres ?? [],
    })),
    nextCursor: nextOffset(offset, rows.length),
  };
}

const DETAIL_COLUMNS = `
  id, kind, slug, title, original_title, release_year, synopsis, cover_url, source, external_id,
  status, comments_locked, created_at, updated_at, created_by, merged_into,
  vote_tallies(uses_ai, no_ai, unsure, counted_total, under_review, updated_at),
  media_genres(genres(slug, name)),
  credits(role, character_name, billing_order, contributors(id, name, kind))
` as const;

export async function getMediaBySlug(db: DbClient, slug: string): Promise<MediaDetail | null> {
  const { data, error } = await db.from("media").select(DETAIL_COLUMNS).eq("slug", slug).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const t = Array.isArray(data.vote_tallies) ? data.vote_tallies[0] : data.vote_tallies;
  return {
    id: data.id,
    kind: data.kind,
    slug: data.slug,
    title: data.title,
    originalTitle: data.original_title,
    year: data.release_year,
    synopsis: data.synopsis,
    coverUrl: data.cover_url,
    source: data.source,
    externalId: data.external_id,
    status: data.status,
    commentsLocked: data.comments_locked,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    createdBy: data.created_by,
    mergedInto: data.merged_into,
    tally: {
      uses_ai: t?.uses_ai ?? 0,
      no_ai: t?.no_ai ?? 0,
      unsure: t?.unsure ?? 0,
      total: t?.counted_total ?? 0,
      underReview: t?.under_review ?? false,
      updatedAt: t?.updated_at ?? null,
    },
    genres: (data.media_genres ?? [])
      .flatMap((mg) => (mg.genres ? [mg.genres] : []))
      .sort((a, b) => a.name.localeCompare(b.name)),
    credits: (data.credits ?? [])
      .flatMap((c) =>
        c.contributors
          ? [{ role: c.role, characterName: c.character_name, billingOrder: c.billing_order, contributor: c.contributors }]
          : [],
      )
      .sort((a, b) => (a.billingOrder ?? 999) - (b.billingOrder ?? 999) || a.contributor.name.localeCompare(b.contributor.name)),
  };
}

/** Slug of a title by id (to follow merges). */
export async function slugById(db: DbClient, id: string): Promise<string | null> {
  const { data } = await db.from("media").select("slug").eq("id", id).maybeSingle();
  return data?.slug ?? null;
}

/** Which catalogue ids already have a visible title here, by "source:id". */
export async function existingCatalogueSlugs(
  db: DbClient,
  source: "tmdb" | "openlibrary",
  externalIds: string[],
): Promise<Map<string, string>> {
  if (externalIds.length === 0) return new Map();
  const { data, error } = await db.from("media").select("slug, external_id").eq("source", source).in("external_id", externalIds);
  if (error) throw error;
  return new Map((data ?? []).flatMap((r) => (r.external_id ? [[r.external_id, r.slug] as [string, string]] : [])));
}

/** The signed-in user's own vote on a title, if any. */
export async function getMyVote(
  db: DbClient,
  mediaId: string,
  userId: string,
): Promise<Database["public"]["Enums"]["vote_value"] | null> {
  const { data } = await db.from("votes").select("value").eq("media_id", mediaId).eq("user_id", userId).maybeSingle();
  return data?.value ?? null;
}

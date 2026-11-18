import "server-only";
import { catalog, CatalogError, sourceForKind, type CatalogSource, type MediaKind } from "@/lib/catalog";
import { existingCatalogueSlugs } from "@/lib/data/media";
import type { CatalogueCard } from "@/lib/services/catalogue";
import { payloadFromCatalogue } from "@/lib/services/media";
import { seedGenres } from "@/lib/services/seed";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DbClient } from "@/lib/supabase/server";

/**
 * Every TMDB, Open Library and AniList title acts as if it were already on
 * the site: search lists them next to ours, and a title's page is created the
 * first time anyone opens it. Votes and comments keep their own rules.
 */

/** Kinds searched when no kind filter is set. Manga only when asked for, to keep it to four calls per search. */
const DEFAULT_KINDS: MediaKind[] = ["movie", "tv_show", "book", "anime"];
const PER_KIND_ALL = 6;
const PER_KIND_ONE = 20;
/** Search waits this long for a catalogue, then shows what it has. */
const SEARCH_TIMEOUT_MS = 4000;
/**
 * A ceiling on titles created by opening them, across the whole site, per
 * hour. Far above real use; it stops a script from filling the database.
 */
export const OPEN_LIMIT_PER_HOUR = 300;

function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([p, new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))]);
}

async function searchOne(db: DbClient, kind: MediaKind, q: string, limit: number): Promise<CatalogueCard[]> {
  try {
    const results = (await catalog().search(kind, q)).slice(0, limit);
    const existing = await existingCatalogueSlugs(
      db,
      sourceForKind(kind),
      results.map((r) => r.externalId),
    );
    return results.map((r) => ({ ...r, altTitles: undefined, existingSlug: existing.get(r.externalId) ?? null }));
  } catch {
    // A catalogue that is down or not configured just adds nothing.
    return [];
  }
}

/**
 * Catalogue matches for a site search. Results from different catalogues are
 * interleaved so one kind does not push the others off the page; a title
 * found twice is listed once.
 */
export async function searchCatalogues(db: DbClient, q: string, kind: MediaKind | undefined): Promise<CatalogueCard[]> {
  const kinds = kind ? [kind] : DEFAULT_KINDS;
  const lists = await Promise.all(
    kinds.map((k) => withTimeout(searchOne(db, k, q, kind ? PER_KIND_ONE : PER_KIND_ALL), SEARCH_TIMEOUT_MS, [])),
  );
  const seen = new Set<string>();
  const out: CatalogueCard[] = [];
  for (let i = 0; i < Math.max(0, ...lists.map((l) => l.length)); i++) {
    for (const list of lists) {
      const r = list[i];
      if (!r) continue;
      const key = r.existingSlug ?? `${r.source}:${r.externalId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(r);
    }
  }
  return out;
}

export class OpenTitleError extends Error {
  constructor(
    message: string,
    readonly status: 404 | 429 | 502 | 503,
  ) {
    super(message);
  }
}

/**
 * The slug of a catalogue title, creating its page first if nobody has opened
 * it yet. Details come from the catalogue by id on the server, never from the
 * request, so this can only ever create real catalogue entries.
 */
export async function openCatalogueTitle(db: DbClient, source: CatalogSource, externalId: string): Promise<string> {
  const existing = (await existingCatalogueSlugs(db, source, [externalId])).get(externalId);
  if (existing) return existing;

  const admin = createAdminClient();
  const since = new Date(Date.now() - 3600_000).toISOString();
  const { count, error: countError } = await admin
    .from("media")
    .select("id", { count: "exact", head: true })
    .is("created_by", null)
    .gte("created_at", since);
  if (countError) throw countError;
  if ((count ?? 0) >= OPEN_LIMIT_PER_HOUR) {
    throw new OpenTitleError("Lots of new titles are being opened right now. Try again in a few minutes.", 429);
  }

  let detail;
  try {
    detail = await catalog().detail(source, externalId);
  } catch (err) {
    if (err instanceof CatalogError) {
      throw new OpenTitleError(err.status === 404 ? "That title was not found." : err.message, err.status === 404 ? 404 : 502);
    }
    throw err;
  }

  const { data, error } = await admin.rpc("create_media", { p: payloadFromCatalogue(detail, seedGenres(detail)) as never }).single();
  if (error) throw error;
  if (!data.existing) {
    // Catalogue entries publish at once. With the secret key there is no
    // caller, so the insert trigger leaves them pending (as for the seed job).
    const { error: pub } = await admin.from("media").update({ status: "published" }).eq("slug", data.slug).eq("status", "pending");
    if (pub) throw pub;
  }
  return data.slug;
}

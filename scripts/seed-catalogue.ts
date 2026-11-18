/**
 * Seed the catalogue with popular movies and TV shows from TMDB, trending
 * books from Open Library and popular anime and manga from AniList, so a
 * fresh environment is not empty, then refresh the "New and trending" list
 * on the home page from TMDB now-playing and this week's trending titles,
 * books, anime and manga.
 *
 *   SUPABASE_URL=... SUPABASE_SECRET_KEY=... TMDB_API_TOKEN=... \
 *   SEED_MOVIES=60 SEED_TV=40 SEED_BOOKS=40 SEED_ANIME=20 SEED_MANGA=20 npx tsx scripts/seed-catalogue.ts
 *
 * SEED_MODE=trending skips the popular lists and only refreshes trending
 * (the daily scheduled run).
 *
 * Titles go through public.create_media(), the same path as "Add a title",
 * so already-added titles are skipped. Run by .github/workflows/seed-staging.yml.
 */
import { createClient } from "@supabase/supabase-js";
import { AniListClient } from "@/lib/catalog/anilist";
import { OpenLibraryClient } from "@/lib/catalog/openlibrary";
import { TmdbClient } from "@/lib/catalog/tmdb";
import type { LookupDetail } from "@/lib/catalog/types";
import type { Database } from "@/lib/database.types";
import { payloadFromCatalogue } from "@/lib/services/media";
import { MIN_TRENDING, interleaveTrending, parseCount, seedGenres, worthSeeding, type TrendingReason } from "@/lib/services/seed";

function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

const ANILIST_PAUSE = 2100;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const db = createClient<Database>(need("SUPABASE_URL"), need("SUPABASE_SECRET_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const tmdb = new TmdbClient(need("TMDB_API_TOKEN"));
  const ol = new OpenLibraryClient();
  const anilist = new AniListClient();
  const trendingOnly = process.env.SEED_MODE === "trending";
  const wanted = {
    movie: trendingOnly ? 0 : parseCount(process.env.SEED_MOVIES, 60),
    tv_show: trendingOnly ? 0 : parseCount(process.env.SEED_TV, 40),
    book: trendingOnly ? 0 : parseCount(process.env.SEED_BOOKS, 40),
    anime: trendingOnly ? 0 : parseCount(process.env.SEED_ANIME, 20),
    manga: trendingOnly ? 0 : parseCount(process.env.SEED_MANGA, 20),
  };
  const stats = { added: 0, existing: 0, skipped: 0, failed: 0 };

  /** Add a title (or find it) and return its id, or null when it was skipped. */
  async function add(load: () => Promise<LookupDetail>, label: string): Promise<string | null> {
    let detail: LookupDetail;
    try {
      detail = await load();
    } catch (err) {
      stats.failed++;
      console.warn(`lookup failed: ${label}: ${String(err)}`);
      return null;
    }
    if (!worthSeeding(detail)) {
      stats.skipped++;
      return null;
    }
    const { data, error } = await db
      .rpc("create_media", { p: payloadFromCatalogue(detail, seedGenres(detail)) as never })
      .single();
    if (error) {
      stats.failed++;
      console.warn(`create failed: ${detail.title}: ${error.message}`);
      return null;
    }
    if (data.existing) {
      stats.existing++;
      // create_media() only returns the slug of an existing title.
      const { data: row, error: findError } = await db.from("media").select("id").eq("slug", data.slug).maybeSingle();
      if (findError) throw findError;
      return row?.id ?? null;
    }
    // Catalogue entries publish at once, as they do for members. With the
    // secret key there is no caller, so the insert trigger leaves them pending.
    const { error: pub } = await db.from("media").update({ status: "published" }).eq("slug", data.slug).eq("status", "pending");
    if (pub) throw pub;
    stats.added++;
    console.log(`added ${detail.kind} ${data.slug}`);
    return data.id;
  }

  // One source failing (Open Library's trending list is slow) must not stop
  // the others, so each list is fetched with retries and errors are logged.
  async function list<T>(name: string, fetchList: () => Promise<T[]>): Promise<T[]> {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        return await fetchList();
      } catch (err) {
        console.warn(`${name} list failed (attempt ${attempt} of 3):`, err instanceof Error ? err.message : err);
        if (attempt < 3) await sleep(5000 * attempt);
      }
    }
    stats.failed++;
    return [];
  }

  for (const kind of ["movie", "tv_show"] as const) {
    let done = 0;
    for (let page = 1; done < wanted[kind] && page <= 10; page++) {
      const results = await list(`TMDB ${kind} page ${page}`, () => tmdb.popular(kind, page));
      if (!results.length) break;
      for (const r of results) {
        if (done >= wanted[kind]) break;
        if (await add(() => tmdb.detail(r.externalId), r.externalId)) done++;
        await sleep(100);
      }
    }
  }

  if (wanted.book > 0) {
    let done = 0;
    for (const id of await list("Open Library trending", () => ol.trending(Math.min(wanted.book * 2, 100)))) {
      if (done >= wanted.book) break;
      if (await add(() => ol.detail(id), id)) done++;
      await sleep(400); // Open Library asks clients to stay gentle
    }
  }

  // AniList's limit is 30 requests a minute at the moment (90 normally), so
  // pace AniList at one request every 2.1 seconds.
  for (const kind of ["anime", "manga"] as const) {
    let done = 0;
    for (let page = 1; done < wanted[kind] && page <= 5; page++) {
      const results = await list(`AniList ${kind} page ${page}`, () => anilist.popular(kind, page));
      if (!results.length) break;
      for (const r of results) {
        if (done >= wanted[kind]) break;
        if (await add(() => anilist.detail(r.externalId), r.externalId)) done++;
        await sleep(ANILIST_PAUSE);
      }
    }
  }

  // "New and trending": what's in cinemas now, this week's trending movies,
  // TV and books. Each list is added to the catalogue, then ranked.
  const perList = parseCount(process.env.SEED_TRENDING, 10, 20);
  const lists: { reason: TrendingReason; ids: string[] }[] = [];
  async function collect(reason: TrendingReason, name: string, results: { externalId: string }[], load: (id: string) => Promise<LookupDetail>, pause: number) {
    const ids: string[] = [];
    for (const r of results.slice(0, perList)) {
      const id = await add(() => load(r.externalId), `${name} ${r.externalId}`);
      if (id) ids.push(id);
      await sleep(pause);
    }
    lists.push({ reason, ids });
  }
  if (perList > 0) {
    const detail = (id: string) => tmdb.detail(id);
    await collect("new", "now playing", await list("TMDB now playing", () => tmdb.nowPlaying()), detail, 100);
    await collect("trending", "trending movie", await list("TMDB trending movies", () => tmdb.trending("movie")), detail, 100);
    await collect("trending", "trending TV", await list("TMDB trending TV", () => tmdb.trending("tv_show")), detail, 100);
    const books = (await list("Open Library weekly trending", () => ol.trending(perList * 2, 45000, "weekly"))).map((externalId) => ({ externalId }));
    await collect("trending", "trending book", books, (id) => ol.detail(id), 400);
    const aniDetail = (id: string) => anilist.detail(id);
    await collect("trending", "trending anime", await list("AniList trending anime", () => anilist.trending("anime", perList)), aniDetail, ANILIST_PAUSE);
    await collect("trending", "trending manga", await list("AniList trending manga", () => anilist.trending("manga", perList)), aniDetail, ANILIST_PAUSE);

    const ranked = interleaveTrending(lists);
    if (ranked.length >= parseCount(process.env.SEED_MIN_TRENDING, MIN_TRENDING)) {
      const refreshedAt = new Date().toISOString();
      const { error: delError } = await db.from("trending_media").delete().not("media_id", "is", null);
      if (delError) throw delError;
      const { error: insError } = await db
        .from("trending_media")
        .insert(ranked.map((e) => ({ media_id: e.mediaId, rank: e.rank, reason: e.reason, refreshed_at: refreshedAt })));
      if (insError) throw insError;
      console.log(`trending list refreshed: ${ranked.length} titles`);
    } else {
      console.warn(`only ${ranked.length} trending titles found, keeping the previous list`);
      stats.failed++;
    }
  }

  console.log(JSON.stringify(stats));
  if (stats.added + stats.existing === 0) process.exitCode = 1;
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});

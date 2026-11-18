/**
 * Seed the catalogue with popular movies and TV shows from TMDB and trending
 * books from Open Library, so a fresh environment is not empty.
 *
 *   SUPABASE_URL=... SUPABASE_SECRET_KEY=... TMDB_API_TOKEN=... \
 *   SEED_MOVIES=60 SEED_TV=40 SEED_BOOKS=40 npx tsx scripts/seed-catalogue.ts
 *
 * Titles go through public.create_media(), the same path as "Add a title",
 * so already-added titles are skipped. Run by .github/workflows/seed-staging.yml.
 */
import { createClient } from "@supabase/supabase-js";
import { OpenLibraryClient } from "@/lib/catalog/openlibrary";
import { TmdbClient } from "@/lib/catalog/tmdb";
import type { LookupDetail } from "@/lib/catalog/types";
import type { Database } from "@/lib/database.types";
import { payloadFromCatalogue } from "@/lib/services/media";
import { parseCount, seedGenres, worthSeeding } from "@/lib/services/seed";

function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const db = createClient<Database>(need("SUPABASE_URL"), need("SUPABASE_SECRET_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const tmdb = new TmdbClient(need("TMDB_API_TOKEN"));
  const ol = new OpenLibraryClient();
  const wanted = {
    movie: parseCount(process.env.SEED_MOVIES, 60),
    tv_show: parseCount(process.env.SEED_TV, 40),
    book: parseCount(process.env.SEED_BOOKS, 40),
  };
  const stats = { added: 0, existing: 0, skipped: 0, failed: 0 };

  async function add(load: () => Promise<LookupDetail>, label: string): Promise<boolean> {
    let detail: LookupDetail;
    try {
      detail = await load();
    } catch (err) {
      stats.failed++;
      console.warn(`lookup failed: ${label}: ${String(err)}`);
      return false;
    }
    if (!worthSeeding(detail)) {
      stats.skipped++;
      return false;
    }
    const { data, error } = await db
      .rpc("create_media", { p: payloadFromCatalogue(detail, seedGenres(detail)) as never })
      .single();
    if (error) {
      stats.failed++;
      console.warn(`create failed: ${detail.title}: ${error.message}`);
      return false;
    }
    if (data.existing) {
      stats.existing++;
      return true;
    }
    // Catalogue entries publish at once, as they do for members. With the
    // secret key there is no caller, so the insert trigger leaves them pending.
    const { error: pub } = await db.from("media").update({ status: "published" }).eq("slug", data.slug).eq("status", "pending");
    if (pub) throw pub;
    stats.added++;
    console.log(`added ${detail.kind} ${data.slug}`);
    return true;
  }

  for (const kind of ["movie", "tv_show"] as const) {
    let done = 0;
    for (let page = 1; done < wanted[kind] && page <= 10; page++) {
      const results = await tmdb.popular(kind, page);
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
    for (const id of await ol.trending(Math.min(wanted.book * 2, 100))) {
      if (done >= wanted.book) break;
      if (await add(() => ol.detail(id), id)) done++;
      await sleep(400); // Open Library asks clients to stay gentle
    }
  }

  console.log(JSON.stringify(stats));
  if (stats.added + stats.existing === 0) process.exitCode = 1;
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});

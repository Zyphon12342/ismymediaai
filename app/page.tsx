import type { Metadata } from "next";
import Link from "next/link";
import { MediaCard } from "@/components/media/media-card";
import { browseMedia, listGenres, trendingMedia } from "@/lib/data/media";
import { pickParams } from "@/lib/http/query";
import { KIND_PLURALS } from "@/lib/services/labels";
import { createClient } from "@/lib/supabase/server";
import { BrowseQuery } from "@/lib/validation/media";

export const metadata: Metadata = {
  title: { absolute: "isMyMediaAI: did this movie, show or book use generative AI?" },
  alternates: { canonical: "/" },
};

const SORTS = [
  { value: "newest", label: "Newest" },
  { value: "most_voted", label: "Most voted" },
  { value: "most_disputed", label: "Most disputed" },
] as const;

const KINDS = [
  { value: "", label: "All" },
  { value: "movie", label: KIND_PLURALS.movie },
  { value: "tv_show", label: KIND_PLURALS.tv_show },
  { value: "book", label: KIND_PLURALS.book },
  { value: "anime", label: KIND_PLURALS.anime },
  { value: "manga", label: KIND_PLURALS.manga },
] as const;

export default async function Home({ searchParams }: PageProps<"/">) {
  const raw = await searchParams;
  const params = new URLSearchParams();
  for (const k of ["q", "kind", "genre", "sort", "cursor"] as const) {
    const v = raw[k];
    if (typeof v === "string") params.set(k, v);
  }
  const query = BrowseQuery.parse(pickParams(params, ["q", "kind", "genre", "sort", "cursor"]));
  const db = await createClient();
  // "New and trending" only on the plain home page, not on searches or later pages.
  const plain = !query.q && !query.kind && !query.genre && !query.sort && !query.cursor;
  const [page, genres, trending] = await Promise.all([
    browseMedia(db, query),
    listGenres(db, query.kind),
    plain ? trendingMedia(db, 12) : Promise.resolve([]),
  ]);
  const genre = genres.some((g) => g.slug === query.genre) ? query.genre : undefined;

  const link = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { q: query.q, kind: query.kind, genre, sort: query.sort, ...over };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `/?${s}` : "/";
  };
  const filtered = !!(query.q || query.kind || genre);

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">Did this use gen AI?</h1>
        <p className="max-w-prose text-zinc-600">
          Community votes, backed by cited evidence, on whether a movie, TV show, book, anime or manga used generative AI.
        </p>
      </section>

      {trending.length ? (
        <section aria-labelledby="trending-heading" className="space-y-4">
          <div>
            <h2 id="trending-heading" className="text-xl font-semibold tracking-tight">
              New and trending
            </h2>
            <p className="text-sm text-zinc-600">In cinemas, on TV, on reading lists and in anime and manga right now. Most have no verdict yet, so your vote counts.</p>
          </div>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {trending.map((m) => (
              <MediaCard key={m.id} media={m} badge={m.reason === "new" ? "New" : "Trending"} />
            ))}
          </ul>
        </section>
      ) : null}

      {trending.length ? (
        <h2 className="text-xl font-semibold tracking-tight">All titles</h2>
      ) : null}

      <form action="/" method="get" role="search" className="space-y-4">
        {query.kind ? <input type="hidden" name="kind" value={query.kind} /> : null}
        <div className="flex gap-2">
          <label htmlFor="q" className="sr-only">
            Search titles
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={query.q ?? ""}
            placeholder="Search movies, TV shows and books"
            maxLength={100}
            className="block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/20"
          />
          <button type="submit" className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700">
            Search
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <nav aria-label="Kind" className="flex gap-1">
            {KINDS.map((k) => {
              const active = (query.kind ?? "") === k.value;
              return (
                <Link
                  key={k.value}
                  href={link({ kind: k.value || undefined, genre: undefined, cursor: undefined })}
                  aria-current={active ? "page" : undefined}
                  className={`rounded-full px-3 py-1 text-sm ${active ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-800 hover:bg-zinc-200"}`}
                >
                  {k.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-2 text-sm">
            <label htmlFor="genre">Genre</label>
            <select id="genre" name="genre" defaultValue={genre ?? ""} className="rounded-md border border-zinc-300 px-2 py-1">
              <option value="">Any</option>
              {genres.map((g) => (
                <option key={g.slug} value={g.slug}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <label htmlFor="sort">Sort</label>
            <select id="sort" name="sort" defaultValue={query.sort ?? ""} className="rounded-md border border-zinc-300 px-2 py-1">
              {query.q ? <option value="">Best match</option> : null}
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="text-sm underline">
            Apply
          </button>
        </div>
      </form>

      {page.items.length ? (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {page.items.map((m) => (
            <MediaCard key={m.id} media={m} />
          ))}
        </ul>
      ) : (
        <div className="space-y-2 rounded-lg border border-dashed border-zinc-300 p-8 text-center">
          <p className="font-medium">{filtered ? "No titles match." : "No titles yet."}</p>
          <p className="text-sm text-zinc-600">
            Can&apos;t find it?{" "}
            <Link href="/titles/new" className="underline">
              Add a title
            </Link>
          </p>
        </div>
      )}

      <div className="flex items-center justify-between">
        {page.nextCursor ? (
          <Link href={link({ cursor: page.nextCursor })} className="text-sm font-medium underline">
            More titles
          </Link>
        ) : (
          <span />
        )}
        <Link href="/titles/new" className="text-sm underline">
          Add a title
        </Link>
      </div>
    </div>
  );
}

import Link from "next/link";
import { catalog, sourceForKind, type LookupResult, type MediaKind } from "@/lib/catalog";
import { existingCatalogueSlugs } from "@/lib/data/media";
import { KIND_PLURALS, SOURCE_NAMES, titlePath } from "@/lib/services/labels";
import type { createClient } from "@/lib/supabase/server";

type DbClient = Awaited<ReturnType<typeof createClient>>;

/** Kinds looked up when no kind filter is set. Manga only when asked for, to keep it to four calls per search. */
const DEFAULT_KINDS: MediaKind[] = ["movie", "tv_show", "book", "anime"];
const PER_KIND_ALL = 4;
const PER_KIND_ONE = 12;

interface Group {
  kind: MediaKind;
  items: (LookupResult & { existingSlug: string | null })[];
}

/** One catalogue's results; a catalogue that is down or not configured just shows nothing. */
async function lookUp(db: DbClient, kind: MediaKind, q: string, limit: number): Promise<Group> {
  try {
    const results = (await catalog().search(kind, q)).slice(0, limit);
    const existing = await existingCatalogueSlugs(
      db,
      sourceForKind(kind),
      results.map((r) => r.externalId),
    );
    return { kind, items: results.map((r) => ({ ...r, existingSlug: existing.get(r.externalId) ?? null })) };
  } catch {
    return { kind, items: [] };
  }
}

/**
 * The site's own search only covers titles someone has added. This looks the
 * same words up in TMDB, Open Library and AniList, so anything findable there
 * can be opened (if it is here) or added (if it is not). Streams in after the
 * site's own results.
 */
export async function CatalogueMatches({ db, q, kind }: { db: DbClient; q: string; kind?: MediaKind }) {
  const kinds = kind ? [kind] : DEFAULT_KINDS;
  const groups = (await Promise.all(kinds.map((k) => lookUp(db, k, q, kind ? PER_KIND_ONE : PER_KIND_ALL)))).filter(
    (g) => g.items.length,
  );
  if (!groups.length) return null;

  return (
    <section aria-labelledby="catalogue-heading" className="space-y-4">
      <div>
        <h2 id="catalogue-heading" className="text-xl font-semibold tracking-tight">
          More matches from TMDB, Open Library and AniList
        </h2>
        <p className="text-sm text-zinc-600">Not here yet? Add it and be the first to vote.</p>
      </div>
      {groups.map((g) => (
        <div key={g.kind} className="space-y-2">
          <h3 className="text-sm font-medium text-zinc-700">
            {KIND_PLURALS[g.kind]} on {SOURCE_NAMES[sourceForKind(g.kind)]}
          </h3>
          <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200">
            {g.items.map((r) => {
              const label = `${r.title}${r.year ? ` (${r.year})` : ""}`;
              return (
                <li key={r.externalId} className="flex items-center gap-3 p-3">
                  {r.coverUrl ? (
                    // Catalogue covers come from fixed hosts allowed by the CSP; small, so no next/image.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.coverUrl} alt="" width={40} height={60} loading="lazy" className="h-15 w-10 shrink-0 rounded object-cover" />
                  ) : (
                    <div aria-hidden="true" className="h-15 w-10 shrink-0 rounded bg-zinc-100" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{label}</p>
                    {r.byline ? <p className="truncate text-sm text-zinc-600">{r.byline}</p> : null}
                  </div>
                  {r.existingSlug ? (
                    <Link href={titlePath(r.existingSlug)} className="shrink-0 text-sm font-medium underline">
                      Open<span className="sr-only"> {label}</span>
                    </Link>
                  ) : (
                    <Link
                      href={`/titles/new?${new URLSearchParams({ kind: g.kind, source: r.source, id: r.externalId })}`}
                      className="shrink-0 rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700"
                    >
                      Add<span className="sr-only"> {label}</span>
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </section>
  );
}

export function CatalogueMatchesLoading() {
  return (
    <p role="status" className="text-sm text-zinc-600">
      Looking in TMDB, Open Library and AniList…
    </p>
  );
}

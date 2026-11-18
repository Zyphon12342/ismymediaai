import { catalog, CatalogError, sourceForKind } from "@/lib/catalog";
import { existingCatalogueSlugs, similarTitles } from "@/lib/data/media";
import { HttpError } from "@/lib/http/errors";
import { withHandler } from "@/lib/http/handler";
import { pickParams } from "@/lib/http/query";
import { findTwin, TWIN_KINDS } from "@/lib/services/media";
import { LookupQuery } from "@/lib/validation/media";

/**
 * Search TMDB, Open Library or AniList to prefill a new entry, marking titles
 * that are already here, and ones that may be here from another catalogue
 * (an anime already listed as a TV show, and the other way round).
 */
export const GET = withHandler({ auth: "verified", rateLimit: "lookup" }, async ({ db, request }) => {
  const q = LookupQuery.safeParse(pickParams(request.nextUrl.searchParams, ["kind", "q"]));
  if (!q.success) throw new HttpError("unprocessable", "Invalid request.", q.error.issues);
  try {
    const results = await catalog().search(q.data.kind, q.data.q);
    const ids = results.map((r) => r.externalId);
    const names = results.flatMap((r) => [r.title, ...(r.altTitles ?? []).slice(0, 8)]);
    const [existing, twins] = await Promise.all([
      existingCatalogueSlugs(db, sourceForKind(q.data.kind), ids),
      similarTitles(db, TWIN_KINDS[q.data.kind], names),
    ]);
    return {
      results: results.map(({ altTitles, ...r }) => {
        const twin = existing.has(r.externalId) ? null : findTwin({ ...r, altTitles }, twins);
        return {
          ...r,
          existingSlug: existing.get(r.externalId) ?? null,
          possibleTwin: twin ? { slug: twin.slug, title: twin.title, kind: twin.kind, year: twin.year } : null,
        };
      }),
    };
  } catch (err) {
    if (err instanceof CatalogError) throw new HttpError("internal", err.message);
    throw err;
  }
});

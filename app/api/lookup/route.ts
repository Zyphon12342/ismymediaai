import { catalog, CatalogError } from "@/lib/catalog";
import { existingCatalogueSlugs } from "@/lib/data/media";
import { HttpError } from "@/lib/http/errors";
import { withHandler } from "@/lib/http/handler";
import { pickParams } from "@/lib/http/query";
import { LookupQuery } from "@/lib/validation/media";

/** Search TMDB or Open Library to prefill a new entry, marking titles that are already here. */
export const GET = withHandler({ auth: "verified", rateLimit: "lookup" }, async ({ db, request }) => {
  const q = LookupQuery.safeParse(pickParams(request.nextUrl.searchParams, ["kind", "q"]));
  if (!q.success) throw new HttpError("unprocessable", "Invalid request.", q.error.issues);
  try {
    const results = await catalog().search(q.data.kind, q.data.q);
    const source = q.data.kind === "book" ? "openlibrary" : "tmdb";
    const existing = await existingCatalogueSlugs(db, source, results.map((r) => r.externalId));
    return { results: results.map((r) => ({ ...r, existingSlug: existing.get(r.externalId) ?? null })) };
  } catch (err) {
    if (err instanceof CatalogError) throw new HttpError("internal", err.message);
    throw err;
  }
});

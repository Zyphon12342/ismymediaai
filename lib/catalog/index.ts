import "server-only";
import { serverEnv } from "@/lib/env.server";
import { fixtureFetch } from "./fixtures";
import { OpenLibraryClient } from "./openlibrary";
import { TmdbClient } from "./tmdb";
import { CatalogError, type CatalogSource, type LookupDetail, type LookupResult, type MediaKind } from "./types";

export * from "./types";

/**
 * The catalogue lookups behind "Add a title". The server calls only these
 * two fixed hosts, never a URL from the request. Local previews and CI use
 * fixtures (CATALOG_FIXTURES=1 in wrangler.jsonc's local vars).
 */
export function catalog() {
  const env = serverEnv();
  const fetchFn = env.CATALOG_FIXTURES ? fixtureFetch : fetch.bind(globalThis);
  const tmdbToken = env.CATALOG_FIXTURES ? "fixture" : env.TMDB_API_TOKEN;
  const tmdb = () => {
    if (!tmdbToken) throw new CatalogError("Film and TV lookup is not configured.", 503);
    return new TmdbClient(tmdbToken, fetchFn);
  };
  const ol = new OpenLibraryClient(fetchFn);

  return {
    search(kind: MediaKind, q: string): Promise<LookupResult[]> {
      return kind === "book" ? ol.search(q) : tmdb().search(kind, q);
    },
    detail(source: CatalogSource, externalId: string): Promise<LookupDetail> {
      return source === "openlibrary" ? ol.detail(externalId) : tmdb().detail(externalId);
    },
  };
}

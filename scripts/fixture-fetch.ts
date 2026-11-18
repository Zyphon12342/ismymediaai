/** Test helper: `tsx --import ./scripts/fixture-fetch.ts` swaps fetch for catalogue fixtures. */
import { fixtureFetch } from "@/lib/catalog/fixtures";

const real = globalThis.fetch.bind(globalThis);
globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  const host = new URL(url).hostname;
  return ["api.themoviedb.org", "openlibrary.org", "graphql.anilist.co"].includes(host) ? fixtureFetch(url, init) : real(input, init);
}) as typeof fetch;

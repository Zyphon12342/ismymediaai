"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";

/**
 * Search box in the site header, so it is on screen on every page without
 * scrolling. Submits a plain GET to the home page's browse list, which works
 * without JavaScript. On the home page it shows the current query and keeps the
 * chosen kind (Movies, Books ...) so searching narrows what is already shown.
 */
export function HeaderSearch() {
  return (
    <Suspense fallback={<SearchForm />}>
      <SearchFromUrl />
    </Suspense>
  );
}

function SearchFromUrl() {
  const onHome = usePathname() === "/";
  const params = useSearchParams();
  return <SearchForm q={onHome ? (params.get("q") ?? "") : ""} kind={onHome ? params.get("kind") : null} />;
}

function SearchForm({ q = "", kind = null }: { q?: string; kind?: string | null }) {
  return (
    <form action="/" method="get" role="search" aria-label="Titles" className="flex w-full gap-2">
      {kind ? <input type="hidden" name="kind" value={kind} /> : null}
      <label htmlFor="site-search" className="sr-only">
        Search titles
      </label>
      <input
        // A new key when the URL changes so the box shows the current query after navigating.
        key={q}
        id="site-search"
        name="q"
        type="search"
        defaultValue={q}
        placeholder="Search movies, shows, books and more"
        maxLength={100}
        enterKeyHint="search"
        className="block w-full min-w-0 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/20"
      />
      <button type="submit" aria-label="Search titles" className="shrink-0 rounded-md bg-zinc-900 px-3 py-1.5 text-white hover:bg-zinc-700">
        <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
          <circle cx="8.5" cy="8.5" r="5.5" />
          <path d="m13 13 4.5 4.5" strokeLinecap="round" />
        </svg>
      </button>
    </form>
  );
}

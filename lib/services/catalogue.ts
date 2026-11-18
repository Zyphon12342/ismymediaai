/** Catalogue search results shown on the site. Pure, safe for any component. */
import type { LookupResult } from "@/lib/catalog/types";
import { titlePath } from "@/lib/services/labels";

/** A catalogue title in search results: here already (slug) or not yet (created on first open, see catalogueHref). */
export interface CatalogueCard extends LookupResult {
  existingSlug: string | null;
}

/** Where a catalogue search result links: its page, or the route that creates it. */
export function catalogueHref(r: Pick<CatalogueCard, "existingSlug" | "source" | "externalId">): string {
  return r.existingSlug ? titlePath(r.existingSlug) : `/titles/open?${new URLSearchParams({ source: r.source, id: r.externalId })}`;
}

import { describe, expect, it } from "vitest";
import { catalogueHref } from "@/lib/services/catalogue";

describe("catalogueHref", () => {
  it("links a title already here to its page", () => {
    expect(catalogueHref({ existingSlug: "dune-2021", source: "tmdb", externalId: "movie/438631" })).toBe("/titles/dune-2021");
  });
  it("links a title not here yet to the route that creates it", () => {
    expect(catalogueHref({ existingSlug: null, source: "tmdb", externalId: "movie/438631" })).toBe(
      "/titles/open?source=tmdb&id=movie%2F438631",
    );
  });
});

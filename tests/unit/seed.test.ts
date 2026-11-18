import { describe, expect, it } from "vitest";
import { OpenLibraryClient, parseOpenLibraryTrending } from "@/lib/catalog/openlibrary";
import { TmdbClient } from "@/lib/catalog/tmdb";
import { FALLBACK_GENRE, parseCount, seedGenres, worthSeeding } from "@/lib/services/seed";

const json = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));

describe("seed rules", () => {
  it("keeps up to 3 distinct genres, else the fallback", () => {
    expect(seedGenres({ genres: ["drama", "drama", "crime", "thriller", "mystery"] })).toEqual(["drama", "crime", "thriller"]);
    expect(seedGenres({ genres: [] })).toEqual([FALLBACK_GENRE]);
  });
  it("skips entries without a year or cover", () => {
    expect(worthSeeding({ title: "A", year: 2000, coverUrl: "https://x/c.jpg" })).toBe(true);
    expect(worthSeeding({ title: "A", year: null, coverUrl: "https://x/c.jpg" })).toBe(false);
    expect(worthSeeding({ title: "A", year: 2000, coverUrl: null })).toBe(false);
    expect(worthSeeding({ title: " ", year: 2000, coverUrl: "https://x/c.jpg" })).toBe(false);
  });
  it("parses counts with a cap", () => {
    expect(parseCount("25", 60)).toBe(25);
    expect(parseCount(undefined, 60)).toBe(60);
    expect(parseCount("abc", 60)).toBe(60);
    expect(parseCount("-1", 60)).toBe(60);
    expect(parseCount("999", 60)).toBe(200);
  });
});

describe("catalogue lists for seeding", () => {
  it("reads TMDB's popular list", async () => {
    let url = "";
    const tmdb = new TmdbClient("t", (u) => {
      url = u;
      return json({ results: [{ id: 7, title: "Seven", release_date: "1995-09-22", poster_path: "/p.jpg" }] });
    });
    const list = await tmdb.popular("movie", 2);
    expect(url).toContain("/movie/popular?page=2");
    expect(list[0]).toMatchObject({ externalId: "movie/7", title: "Seven", year: 1995 });
    await tmdb.popular("tv_show");
    expect(url).toContain("/tv/popular?page=1");
  });
  it("reads Open Library's trending works", async () => {
    expect(
      parseOpenLibraryTrending({ works: [{ key: "/works/OL1W" }, { key: "/works/OL1W" }, { key: "/books/OL2M" }, { nope: 1 }, { key: "/works/OL3W" }] }),
    ).toEqual(["OL1W", "OL3W"]);
    expect(parseOpenLibraryTrending(null)).toEqual([]);
    let url = "";
    const ol = new OpenLibraryClient((u) => {
      url = u;
      return json({ works: [{ key: "/works/OL9W" }] });
    });
    expect(await ol.trending(500)).toEqual(["OL9W"]);
    expect(url).toContain("/trending/yearly.json?limit=100");
  });
});

describe("trending list", () => {
  it("takes one from each list in turn, skipping repeats", async () => {
    const { interleaveTrending } = await import("@/lib/services/seed");
    const out = interleaveTrending([
      { reason: "new", ids: ["a", "b", "c"] },
      { reason: "trending", ids: ["b", "d"] },
      { reason: "trending", ids: ["e"] },
    ]);
    expect(out.map((e) => e.mediaId)).toEqual(["a", "b", "e", "d", "c"]);
    expect(out.map((e) => e.rank)).toEqual([1, 2, 3, 4, 5]);
    expect(out.find((e) => e.mediaId === "b")?.reason).toBe("trending");
    expect(out[0]?.reason).toBe("new");
  });
  it("stops at the cap and copes with empty lists", async () => {
    const { interleaveTrending } = await import("@/lib/services/seed");
    expect(interleaveTrending([{ reason: "new", ids: ["a", "b", "c"] }], 2).map((e) => e.mediaId)).toEqual(["a", "b"]);
    expect(interleaveTrending([])).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import { fixtureFetch } from "@/lib/catalog/fixtures";
import { OpenLibraryClient, isWorkId, mapSubjects, parseOpenLibraryDetail, parseOpenLibrarySearch } from "@/lib/catalog/openlibrary";
import { TmdbClient, mapTmdbGenres, parseTmdbDetail, parseTmdbId, parseTmdbSearch } from "@/lib/catalog/tmdb";
import { CatalogError } from "@/lib/catalog/types";
import { arr, clip, firstDistinct, yearOf } from "@/lib/catalog/util";

describe("catalogue helpers", () => {
  it("parses years", () => {
    expect(yearOf("2031-05-02")).toBe(2031);
    expect(yearOf(1999)).toBe(1999);
    expect(yearOf("")).toBeNull();
    expect(yearOf("0001-01-01")).toBeNull();
    expect(yearOf(null)).toBeNull();
  });
  it("clips text", () => {
    expect(clip("  a  b ", 10)).toBe("a b");
    expect(clip("abcdef", 4)).toBe("abc…");
    expect(clip("   ", 4)).toBeNull();
    expect(clip(5, 4)).toBeNull();
  });
  it("keeps distinct values", () => {
    expect(firstDistinct([1, 1, 2, 3, 4], 3)).toEqual([1, 2, 3]);
    expect(arr("x")).toEqual([]);
  });
});

describe("TMDB", () => {
  it("maps genres to ours, at most 3", () => {
    expect(mapTmdbGenres([18, 878, 10765, 35])).toEqual(["drama", "sci-fi", "fantasy"]);
    expect(mapTmdbGenres([10402])).toEqual([]);
  });
  it("parses ids", () => {
    expect(parseTmdbId("movie/603")).toEqual({ type: "movie", id: 603 });
    expect(parseTmdbId("tv/1")).toEqual({ type: "tv", id: 1 });
    expect(parseTmdbId("person/1")).toBeNull();
  });
  it("parses search results and ignores junk", () => {
    const r = parseTmdbSearch("movie", { results: [{ id: 1, title: "X", release_date: "2020-01-01", poster_path: "/a.jpg" }, { title: "no id" }, "junk"] });
    expect(r).toEqual([{ source: "tmdb", externalId: "movie/1", kind: "movie", title: "X", year: 2020, coverUrl: "https://image.tmdb.org/t/p/w500/a.jpg", byline: null }]);
    expect(parseTmdbSearch("tv", null)).toEqual([]);
    expect(parseTmdbSearch("movie", { results: [{ id: 2, title: "Y", poster_path: "/../evil" }] })[0]?.coverUrl).toBeNull();
  });
  it("rejects a malformed detail", () => {
    expect(() => parseTmdbDetail("movie", { title: "no id" })).toThrow(CatalogError);
  });
  it("searches and loads details through the client (fixtures)", async () => {
    const c = new TmdbClient("t", fixtureFetch);
    const found = await c.search("movie", "sample film");
    expect(found.map((f) => f.externalId)).toEqual(["movie/900001", "movie/900002"]);
    const d = await c.detail("movie/900001");
    expect(d.genres).toEqual(["drama", "sci-fi"]);
    expect(d.byline).toBe("Cleo Director");
    expect(d.credits.map((x) => x.role)).toEqual(["director", "writer", "composer", "actor", "actor", "studio"]);
    expect(d.credits.find((x) => x.role === "actor")).toMatchObject({ characterName: "Projectionist", billingOrder: 0 });
    const tv = await c.detail("tv/910001");
    expect(tv.kind).toBe("tv_show");
    expect(tv.credits.map((x) => x.role)).toEqual(["creator", "actor", "network"]);
    expect(await c.search("tv_show", "example")).toHaveLength(1);
    await expect(c.detail("movie/1")).rejects.toMatchObject({ status: 404 });
    await expect(c.detail("bad")).rejects.toMatchObject({ status: 400 });
  });
  it("reports outages", async () => {
    const c = new TmdbClient("t", async () => new Response("", { status: 500 }));
    await expect(c.search("movie", "x")).rejects.toMatchObject({ status: 502 });
  });
});

describe("Open Library", () => {
  it("maps subjects", () => {
    expect(mapSubjects(["Science Fiction", "Space opera", "Juvenile fiction", "Poetry", "Humor"])).toEqual(["sci-fi", "childrens", "poetry"]);
  });
  it("validates work ids", () => {
    expect(isWorkId("OL45883W")).toBe(true);
    expect(isWorkId("OL45883A")).toBe(false);
  });
  it("parses search", () => {
    expect(parseOpenLibrarySearch({ docs: [{ key: "/works/OL1W", title: "T", author_name: ["A", "B", "C"], cover_i: 5, first_publish_year: 2001 }, { key: "/books/OL1M", title: "x" }] })).toEqual([
      { source: "openlibrary", externalId: "OL1W", kind: "book", title: "T", year: 2001, coverUrl: "https://covers.openlibrary.org/b/id/5-L.jpg", byline: "A, B" },
    ]);
    expect(parseOpenLibrarySearch(null)).toEqual([]);
  });
  it("parses detail with string or object descriptions", () => {
    const d = parseOpenLibraryDetail({ key: "/works/OL2W", title: "W", description: "Text\n----------\nSource notes", subjects: ["Fantasy"] }, { author_name: ["N"], author_key: ["OL9A"] });
    expect(d).toMatchObject({ synopsis: "Text", genres: ["fantasy"], credits: [{ name: "N", role: "author", externalId: "OL9A" }], coverUrl: null });
    expect(() => parseOpenLibraryDetail({ title: "no key" }, null)).toThrow(CatalogError);
    expect(() => parseOpenLibraryDetail("x", null)).toThrow(CatalogError);
  });
  it("searches and loads details through the client (fixtures)", async () => {
    const c = new OpenLibraryClient(fixtureFetch);
    expect((await c.search("examples"))[0]?.externalId).toBe("OL900001W");
    const d = await c.detail("OL900002W");
    expect(d.credits.map((x) => x.name)).toEqual(["Ivo Poet", "Jun Poet"]);
    expect(d.genres).toEqual(["poetry"]);
    await expect(c.detail("OL1W")).rejects.toMatchObject({ status: 404 });
    await expect(c.detail("nope")).rejects.toMatchObject({ status: 400 });
  });
});

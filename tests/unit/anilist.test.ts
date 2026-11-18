import { describe, expect, it } from "vitest";
import { AniListClient, cleanDescription, mapAniListGenres, parseAniListDetail, parseAniListId, parseAniListSearch } from "@/lib/catalog/anilist";
import { fixtureFetch } from "@/lib/catalog/fixtures";
import { CatalogError } from "@/lib/catalog/types";
import { sourceName } from "@/lib/services/labels";
import { findTwin, roleAllowed, TWIN_KINDS } from "@/lib/services/media";
import { workJsonLd } from "@/lib/services/seo";
import { sourceUrl } from "@/lib/services/verdict";
import { CreateMediaInput, LookupDetailQuery, LookupQuery } from "@/lib/validation/media";

const client = new AniListClient(fixtureFetch);

describe("AniList", () => {
  it("parses ids", () => {
    expect(parseAniListId("anime/21")).toEqual({ type: "anime", id: 21 });
    expect(parseAniListId("manga/30013")).toEqual({ type: "manga", id: 30013 });
    expect(parseAniListId("tv/21")).toBeNull();
    expect(parseAniListId("anime/x")).toBeNull();
  });

  it("maps genres to ours, at most 3, skipping ones we do not track", () => {
    expect(mapAniListGenres(["Ecchi", "Slice of Life", "Comedy"])).toEqual(["slice-of-life", "comedy"]);
    expect(mapAniListGenres(["Action", "Adventure", "Supernatural", "Mecha", "Sports"])).toEqual(["action", "fantasy", "mecha"]);
  });

  it("cleans descriptions", () => {
    expect(cleanDescription("A <i>quiet</i> story.<br><br>Second &amp; last.\n(Source: Somewhere)")).toBe("A quiet story. Second & last.");
    expect(cleanDescription(null)).toBeNull();
    expect(cleanDescription("a <scr<script>ipt>alert(1)</script> &lt;b&gt;")).not.toMatch(/[<>]/);
  });

  it("searches anime, preferring the English title and marking other names", async () => {
    const [r] = await client.search("anime", "placeholder");
    expect(r).toMatchObject({
      source: "anilist",
      externalId: "anime/920001",
      kind: "anime",
      title: "Placeholder Academy",
      year: 2034,
      byline: "Studio Fixture",
    });
    expect(r!.altTitles).toEqual(["Placeholder Academy", "Hoshi no Gakuen", "星の学園"]);
  });

  it("finds manga by romaji or synonym and falls back to the romaji title", async () => {
    const [r] = await client.search("manga", "fixture chronicle");
    expect(r).toMatchObject({ externalId: "manga/930001", kind: "manga", title: "Fikusucha Monogatari", byline: "Mei Mangaka" });
    expect(await client.search("anime", "fixture chronicle")).toEqual([]);
  });

  it("drops adult entries", () => {
    const body = { data: { Page: { media: [{ id: 1, isAdult: true, title: { romaji: "x" } }, { id: 2, title: { romaji: "y" } }] } } };
    expect(parseAniListSearch("anime", body).map((r) => r.externalId)).toEqual(["anime/2"]);
    expect(() => parseAniListDetail("anime", { data: { Media: { id: 1, isAdult: true, title: { romaji: "x" } } } })).toThrow(CatalogError);
  });

  it("reads anime details: staff, voice cast and main studio only", async () => {
    const d = await client.detail("anime/920001");
    expect(d.originalTitle).toBe("Hoshi no Gakuen");
    expect(d.synopsis).toBe("Students at an academy that only exists in tests.");
    expect(d.genres).toEqual(["comedy", "slice-of-life"]);
    expect(d.coverUrl).toMatch(/^https:\/\/s4\.anilist\.co\//);
    expect(d.credits).toEqual([
      { name: "Kei Director", kind: "person", role: "director", externalId: "staff/8201" },
      { name: "Rin Creator", kind: "person", role: "creator", externalId: "staff/8202" },
      { name: "Sora Composer", kind: "person", role: "composer", externalId: "staff/8203" },
      { name: "Yui Voice", kind: "person", role: "actor", externalId: "staff/8205", billingOrder: 0, characterName: "Aoi Student" },
      { name: "Studio Fixture", kind: "company", role: "studio", externalId: "studio/7201" },
    ]);
    expect(d.credits.every((c) => roleAllowed("anime", c.role))).toBe(true);
  });

  it("reads manga details: story and art become author and illustrator", async () => {
    const d = await client.detail("manga/930001");
    expect(d.originalTitle).toBe("フィクスチャ物語");
    expect(d.credits.map((c) => c.role)).toEqual(["author", "illustrator", "translator"]);
    expect(d.credits.every((c) => roleAllowed("manga", c.role))).toBe(true);
    expect(d.byline).toBe("Mei Mangaka");
  });

  it("rejects bad ids and reports missing entries", async () => {
    await expect(client.detail("tv/1")).rejects.toMatchObject({ status: 400 });
    await expect(client.detail("anime/1")).rejects.toMatchObject({ status: 404 });
    await expect(client.detail("manga/920001")).rejects.toMatchObject({ status: 404 });
  });

  it("only accepts covers from AniList's image host", () => {
    const body = { data: { Media: { id: 3, title: { romaji: "z" }, coverImage: { extraLarge: "https://evil.example/x.jpg" } } } };
    expect(parseAniListDetail("anime", body).coverUrl).toBeNull();
  });

  it("surfaces rate limiting as a retryable error", async () => {
    const busy = new AniListClient(async () => new Response("{}", { status: 429 }));
    await expect(busy.search("anime", "x")).rejects.toMatchObject({ status: 503 });
  });
});

describe("anime and manga across the app", () => {
  it("validates kinds, sources and ids", () => {
    expect(LookupQuery.safeParse({ kind: "anime", q: "x" }).success).toBe(true);
    expect(LookupQuery.safeParse({ kind: "manga", q: "x" }).success).toBe(true);
    expect(LookupDetailQuery.safeParse({ source: "anilist", id: "anime/21" }).success).toBe(true);
    expect(LookupDetailQuery.safeParse({ source: "anilist", id: "anime/../x" }).success).toBe(false);
    expect(CreateMediaInput.safeParse({ source: "anilist", externalId: "manga/1", genres: ["mecha"] }).success).toBe(true);
  });

  it("links to AniList and names it", () => {
    expect(sourceUrl("anilist", "anime/21")).toBe("https://anilist.co/anime/21");
    expect(sourceUrl("anilist", "manga/5")).toBe("https://anilist.co/manga/5");
    expect(sourceUrl("anilist", "bad")).toBeNull();
    expect(sourceName("anilist")).toBe("AniList");
    expect(sourceName("tmdb")).toBe("TMDB");
    expect(sourceName("toString")).toBe("toString");
  });

  it("describes anime as a series and manga as a book for search engines", () => {
    const base = { url: "https://x", title: "T", year: 2020, coverUrl: null, synopsis: null, genres: [] };
    const anime = workJsonLd({ ...base, kind: "anime", people: [{ role: "creator", name: "C" }, { role: "actor", name: "V" }] });
    expect(anime).toMatchObject({ "@type": "TVSeries", startDate: "2020", creator: [{ name: "C" }], actor: [{ name: "V" }] });
    const manga = workJsonLd({ ...base, kind: "manga", people: [{ role: "author", name: "A" }] });
    expect(manga).toMatchObject({ "@type": "Book", datePublished: "2020", author: [{ name: "A" }] });
    expect(manga.actor).toBeUndefined();
  });

  it("pairs kinds that may hold the same work", () => {
    expect(TWIN_KINDS.anime).toEqual(["tv_show", "movie"]);
    expect(TWIN_KINDS.tv_show).toEqual(["anime"]);
    expect(TWIN_KINDS.manga).toEqual(["book"]);
  });

  it("spots the same work under another name, within a year", () => {
    const candidates = [
      { slug: "attack-on-titan", title: "Attack on Titan", originalTitle: "進撃の巨人", kind: "tv_show" as const, year: 2013 },
      { slug: "other", title: "Other", originalTitle: null, kind: "movie" as const, year: null },
    ];
    expect(findTwin({ title: "Shingeki no Kyojin", year: 2013, altTitles: ["進撃の巨人"] }, candidates)?.slug).toBe("attack-on-titan");
    expect(findTwin({ title: "attack on titan ", year: 2014 }, candidates)?.slug).toBe("attack-on-titan");
    expect(findTwin({ title: "Attack on Titan", year: 2020 }, candidates)).toBeNull();
    expect(findTwin({ title: "OTHER", year: 1990 }, candidates)?.slug).toBe("other");
    expect(findTwin({ title: "Nothing", year: null }, candidates)).toBeNull();
  });
});

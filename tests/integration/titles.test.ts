import { describe, expect, it } from "vitest";
import { APP_URL, admin, namedUser } from "./env";

const post = (cookie: string, body: unknown) =>
  fetch(`${APP_URL}/api/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: APP_URL, Cookie: cookie },
    body: JSON.stringify(body),
  });

// The local Worker serves catalogue fixtures (CATALOG_FIXTURES=1), so these
// tests never reach TMDB or Open Library. Fixture ids: movie/900001,
// movie/900002, tv/910001, OL900001W, OL900002W.
describe("catalogue lookup", () => {
  it("needs a verified account", async () => {
    expect((await fetch(`${APP_URL}/api/lookup?kind=movie&q=sample`)).status).toBe(401);
  });

  it("searches and previews", async () => {
    const u = await namedUser("looker");
    const res = await fetch(`${APP_URL}/api/lookup?kind=book&q=examples`, { headers: { Cookie: u.cookie } });
    expect(res.status).toBe(200);
    const { results } = (await res.json()) as { results: { externalId: string; existingSlug: string | null }[] };
    expect(results[0]).toMatchObject({ externalId: "OL900001W" });

    const d = await fetch(`${APP_URL}/api/lookup/detail?source=tmdb&id=tv/910001`, { headers: { Cookie: u.cookie } });
    expect(d.status).toBe(200);
    expect(((await d.json()) as { credits: { role: string }[] }).credits.map((c) => c.role)).toContain("creator");

    expect((await fetch(`${APP_URL}/api/lookup/detail?source=tmdb&id=https://evil.example`, { headers: { Cookie: u.cookie } })).status).toBe(422);
  });
});

describe("POST /api/media", () => {
  it("adds a catalogue title from server-side details, once", async () => {
    const u = await namedUser("adder");
    // Clean slate for the fixture id (other runs may have added it).
    await admin().from("media").delete().eq("source", "tmdb").eq("external_id", "movie/900002");

    const res = await post(u.cookie, { source: "tmdb", externalId: "movie/900002", genres: ["thriller"] });
    expect(res.status).toBe(201);
    const created = (await res.json()) as { slug: string; status: string };
    expect(created).toMatchObject({ slug: expect.stringMatching(/^sample-film-two-2033/), status: "published" });

    const again = await post(u.cookie, { source: "tmdb", externalId: "movie/900002", genres: ["thriller"] });
    expect(again.status).toBe(200);
    expect(((await again.json()) as { existing: boolean; slug: string }).slug).toBe(created.slug);

    const detail = (await (await fetch(`${APP_URL}/api/media/${created.slug}`)).json()) as {
      title: string;
      credits: { role: string }[];
      genres: { slug: string }[];
    };
    expect(detail.title).toBe("Sample Film Two");
    expect(detail.credits.map((c) => c.role)).toEqual(["director"]);
    expect(detail.genres.map((g) => g.slug)).toEqual(["thriller"]);

    const lookup = await fetch(`${APP_URL}/api/lookup?kind=movie&q=sample film two`, { headers: { Cookie: u.cookie } });
    const { results } = (await lookup.json()) as { results: { externalId: string; existingSlug: string | null }[] };
    expect(results.find((r) => r.externalId === "movie/900002")?.existingSlug).toBe(created.slug);
  });

  it("rejects forged details and bad genres", async () => {
    const u = await namedUser("forger");
    expect((await post(u.cookie, { source: "tmdb", externalId: "movie/900001", genres: ["drama"], title: "Forged" })).status).toBe(422);
    expect((await post(u.cookie, { source: "openlibrary", externalId: "OL900002W", genres: ["animation"] })).status).toBe(422);
  });

  it("sends manual entries to review", async () => {
    const u = await namedUser("manual");
    const res = await post(u.cookie, {
      source: "manual", kind: "book", title: `Hand Made ${crypto.randomUUID().slice(0, 6)}`, year: 2031,
      genres: ["poetry"], credits: [{ name: "Some Poet", role: "author" }],
    });
    expect(res.status).toBe(201);
    const { slug, status } = (await res.json()) as { slug: string; status: string };
    expect(status).toBe("pending");
    expect((await fetch(`${APP_URL}/api/media/${slug}`)).status).toBe(404);
    expect((await fetch(`${APP_URL}/api/media/${slug}`, { headers: { Cookie: u.cookie } })).status).toBe(200);
  });

  it("refuses new accounts", async () => {
    const u = await namedUser("fresh", 0);
    const res = await post(u.cookie, { source: "tmdb", externalId: "movie/900001", genres: ["drama"] });
    expect(res.status).toBe(403);
  });
});

describe("browse", () => {
  it("filters by kind, genre and search", async () => {
    const u = await namedUser("browser");
    await admin().from("media").delete().eq("source", "openlibrary").eq("external_id", "OL900001W");
    expect((await post(u.cookie, { source: "openlibrary", externalId: "OL900001W", genres: ["sci-fi", "non-fiction"] })).status).toBe(201);

    const list = async (qs: string) =>
      ((await (await fetch(`${APP_URL}/api/media?${qs}`)).json()) as { items: { title: string; kind: string }[] }).items;
    expect((await list("kind=book&genre=non-fiction")).map((m) => m.title)).toContain("A Book of Examples");
    expect((await list("kind=movie&genre=non-fiction")).length).toBe(0);
    expect((await list("q=book of exam")).map((m) => m.title)).toContain("A Book of Examples");
    expect((await fetch(`${APP_URL}/api/media?kind=nonsense&sort=whatever`)).status).toBe(200);

    const genres = (await (await fetch(`${APP_URL}/api/genres?kind=book`)).json()) as { slug: string }[];
    expect(genres.map((g) => g.slug)).toContain("poetry");
    expect(genres.map((g) => g.slug)).not.toContain("animation");
  });
});

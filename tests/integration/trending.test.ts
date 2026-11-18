import { describe, expect, it } from "vitest";
import { APP_URL, admin, publishedTitle } from "./env";

describe("New and trending on the home page", () => {
  it("lists the trending titles in order, with a badge, only on the plain home page", async () => {
    const tag = crypto.randomUUID().slice(0, 8);
    const first = await publishedTitle(`it-trend-a-${tag}`);
    const second = await publishedTitle(`it-trend-b-${tag}`);
    const a = admin();
    await a.from("media").update({ release_year: 2026 }).in("id", [first, second]);
    await a.from("trending_media").delete().not("media_id", "is", null);
    const { error } = await a.from("trending_media").insert([
      { media_id: second, rank: 1, reason: "new" },
      { media_id: first, rank: 2, reason: "trending" },
    ]);
    expect(error).toBeNull();

    const html = await (await fetch(`${APP_URL}/`)).text();
    const section = html.slice(html.indexOf("New and trending"), html.indexOf("All titles"));
    expect(section).toContain(`it-trend-b-${tag}`);
    expect(section.indexOf(`it-trend-b-${tag}`)).toBeLessThan(section.indexOf(`it-trend-a-${tag}`));
    expect(section).toContain(">New<");
    expect(section).toContain(">Trending<");
    expect(section).toContain("No verdict yet. Be the first to vote");

    const searched = await (await fetch(`${APP_URL}/?q=it-trend`)).text();
    expect(searched).not.toContain("New and trending");

    await a.from("trending_media").delete().in("media_id", [first, second]);
  });
});

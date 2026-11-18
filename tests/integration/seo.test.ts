import { describe, expect, it } from "vitest";
import { APP_URL, publishedTitle } from "./env";

describe("search engine files", () => {
  it("lists published titles in the sitemap", async () => {
    const slug = `it-seo-${crypto.randomUUID().slice(0, 8)}`;
    await publishedTitle(slug);
    const res = await fetch(`${APP_URL}/sitemap.xml`);
    expect(res.status).toBe(200);
    const xml = await res.text();
    expect(xml).toContain("<urlset");
    expect(xml).toContain(`/titles/${slug}</loc>`);
  });

  it("keeps non-production sites out of search", async () => {
    const res = await fetch(`${APP_URL}/robots.txt`);
    expect(res.status).toBe(200);
    expect(await res.text()).toMatch(/User-Agent: \*\s+Disallow: \//);
  });

  it("server-renders the question, verdict, FAQ and structured data", async () => {
    const slug = `it-seo-${crypto.randomUUID().slice(0, 8)}`;
    await publishedTitle(slug);
    const html = await (await fetch(`${APP_URL}/titles/${slug}`)).text();
    expect(html).toContain("AI-generated?</h1>");
    expect(html).toContain("No community votes yet.");
    expect(html).toContain('"@type":"FAQPage"');
    expect(html).toContain('"@type":"Movie"');
  });

  it("redirects trailing slashes to one URL per page, but not on the analytics proxy", async () => {
    const res = await fetch(`${APP_URL}/sign-in/?next=%2Fx`, { redirect: "manual" });
    expect(res.status).toBe(308);
    expect(new URL(res.headers.get("location")!, APP_URL).pathname + new URL(res.headers.get("location")!, APP_URL).search).toBe("/sign-in?next=%2Fx");
    const ingest = await fetch(`${APP_URL}/ingest/i/v0/e/`, { redirect: "manual" });
    expect(ingest.status).toBe(404); // no PostHog key locally, and no redirect
  });
});

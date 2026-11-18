import { describe, expect, it } from "vitest";
import { NAMED_CRAWLERS, faqJsonLd, relatedReason, robotsRules, serializeJsonLd, titleFaq, titleQuestion, workJsonLd } from "@/lib/services/seo";

describe("title question", () => {
  it("includes the year when known", () => {
    expect(titleQuestion("Die Hard", 1988)).toBe("Is Die Hard (1988) AI-generated?");
    expect(titleQuestion("Untitled", null)).toBe("Is Untitled AI-generated?");
  });
});

describe("FAQ", () => {
  const faq = titleFaq({ title: "Die Hard", year: 1988, kind: "movie", verdict: "No community votes yet.", commentCount: 2 });
  it("asks the search question first and never states a fact", () => {
    expect(faq[0]!.question).toBe("Did Die Hard (1988) use generative AI?");
    expect(faq[0]!.answer).toContain("not a confirmed fact");
    expect(faq[0]!.answer).toContain("2 comments");
  });
  it("handles a title with no comments", () => {
    const none = titleFaq({ title: "A Book", year: null, kind: "book", verdict: "x", commentCount: 0 });
    expect(none[0]!.answer).toContain("No one has shared evidence for this book yet.");
    expect(none[3]!.answer).toContain("book's details");
    const one = titleFaq({ title: "A Show", year: 2020, kind: "tv_show", verdict: "x", commentCount: 1 });
    expect(one[0]!.answer).toContain("1 comment on");
  });
  it("builds matching FAQPage structured data", () => {
    const ld = faqJsonLd(faq) as { "@type": string; mainEntity: { name: string; acceptedAnswer: { text: string } }[] };
    expect(ld["@type"]).toBe("FAQPage");
    expect(ld.mainEntity.map((q) => q.name)).toEqual(faq.map((f) => f.question));
    expect(ld.mainEntity[0]!.acceptedAnswer.text).toBe(faq[0]!.answer);
  });
});

describe("work structured data", () => {
  const people = [
    { role: "director", name: "Dee Rector" },
    { role: "actor", name: "Ann Actor" },
    { role: "creator", name: "Cree Ator" },
    { role: "author", name: "Aw Thor" },
  ];
  it("describes a movie", () => {
    const ld = workJsonLd({ url: "https://x/t", title: "F", year: 2000, kind: "movie", coverUrl: "https://i/c.jpg", synopsis: "s", people, genres: ["Drama"] });
    expect(ld).toMatchObject({ "@type": "Movie", datePublished: "2000", image: "https://i/c.jpg", genre: ["Drama"] });
    expect(ld.director).toEqual([{ "@type": "Person", name: "Dee Rector" }]);
    expect(ld.actor).toEqual([{ "@type": "Person", name: "Ann Actor" }]);
    expect(ld.author).toBeUndefined();
  });
  it("describes a series and a book", () => {
    const tv = workJsonLd({ url: "u", title: "S", year: 2001, kind: "tv_show", coverUrl: null, synopsis: null, people, genres: [] });
    expect(tv).toMatchObject({ "@type": "TVSeries", startDate: "2001", creator: [{ "@type": "Person", name: "Cree Ator" }] });
    expect(tv.image).toBeUndefined();
    const book = workJsonLd({ url: "u", title: "B", year: null, kind: "book", coverUrl: null, synopsis: null, people, genres: [] });
    expect(book).toMatchObject({ "@type": "Book", author: [{ "@type": "Person", name: "Aw Thor" }] });
    expect(book.actor).toBeUndefined();
    expect(book.datePublished).toBeUndefined();
  });
});

describe("serializeJsonLd", () => {
  it("cannot close the script tag and still parses back", () => {
    const evil = { name: "</script><script>alert(1)</script> & \u2028\u2029" };
    const out = serializeJsonLd(evil);
    expect(out).not.toContain("<");
    expect(out).not.toContain(">");
    expect(out).not.toContain("&");
    expect(out).not.toMatch(/[\u2028\u2029]/);
    expect(JSON.parse(out)).toEqual(evil);
  });
});

describe("related reason", () => {
  it("names shared people, else genres", () => {
    expect(relatedReason(["A"], 0)).toBe("With A");
    expect(relatedReason(["A", "B"], 1)).toBe("With A and B");
    expect(relatedReason(["A", "B", "C"], 1)).toBe("With A, B and others");
    expect(relatedReason([], 1)).toBe("Same genre");
    expect(relatedReason([], 2)).toBe("2 genres in common");
  });
});

describe("robots rules", () => {
  it("opens production to the named crawlers and hides private pages", () => {
    const r = robotsRules("https://ismymediaai.com");
    expect(r.rules.map((x) => x.userAgent)).toEqual([...NAMED_CRAWLERS, "*"]);
    expect(NAMED_CRAWLERS).toEqual(expect.arrayContaining(["Googlebot", "Bingbot", "OAI-SearchBot", "PerplexityBot", "GPTBot"]));
    expect(r.rules[0]!.allow).toBe("/");
    expect(r.rules[0]!.disallow).toContain("/api/");
    expect(r.rules[0]!.disallow).not.toContain("/titles/");
    expect(r.sitemap).toBe("https://ismymediaai.com/sitemap.xml");
  });
  it("closes staging and local sites", () => {
    expect(robotsRules("https://staging.ismymediaai.com").rules).toEqual([{ userAgent: "*", disallow: "/" }]);
    expect(robotsRules("http://localhost:3000").sitemap).toBeUndefined();
  });
});

import { describe, expect, it } from "vitest";
import type { LookupDetail } from "@/lib/catalog/types";
import {
  decodeOffset,
  groupCredits,
  nextOffset,
  payloadFromCatalogue,
  payloadFromManual,
  roleAllowed,
  roleLabel,
} from "@/lib/services/media";
import { sourceUrl, verdictKind, verdictSentence } from "@/lib/services/verdict";
import { BrowseQuery, CreateMediaInput, LookupDetailQuery, LookupQuery, isCompanyRole } from "@/lib/validation/media";

const detail: LookupDetail = {
  source: "tmdb",
  externalId: "movie/1",
  kind: "movie",
  title: "Big Film",
  originalTitle: null,
  year: 2030,
  coverUrl: null,
  byline: null,
  synopsis: "s",
  genres: ["drama"],
  credits: [
    { name: "A", kind: "person", role: "actor", externalId: "person/1", characterName: "Hero", billingOrder: 0 },
    { name: "B", kind: "person", role: "author", externalId: "person/2" },
    { name: "C", kind: "person", role: "director", externalId: "person/3", characterName: "ignored" },
  ],
};

describe("create payloads", () => {
  it("builds from a catalogue result, dropping roles that do not fit", () => {
    const p = payloadFromCatalogue(detail, ["drama", "sci-fi"]);
    expect(p.slug).toBe("big-film-2030");
    expect(p.genres).toEqual(["drama", "sci-fi"]);
    expect(p.credits.map((c) => c.role)).toEqual(["actor", "director"]);
    expect(p.credits[1]?.character_name).toBeNull();
  });
  it("builds from the manual form", () => {
    const input = CreateMediaInput.parse({
      source: "manual", kind: "book", title: "My Book", year: "2020", genres: ["poetry"],
      credits: [{ name: "Me", role: "author" }, { name: "Pub", role: "publisher" }, { name: "X", role: "director" }],
    });
    if (input.source !== "manual") throw new Error("expected manual");
    const p = payloadFromManual(input);
    expect(p).toMatchObject({ slug: "my-book-2020", source: "manual", external_id: null, release_year: 2020 });
    expect(p.credits).toEqual([
      { name: "Me", kind: "person", role: "author", external_id: null, character_name: null, billing_order: null },
      { name: "Pub", kind: "company", role: "publisher", external_id: null, character_name: null, billing_order: null },
    ]);
  });
});

describe("validation", () => {
  it("accepts catalogue ids only in known shapes", () => {
    expect(LookupDetailQuery.safeParse({ source: "tmdb", id: "movie/12" }).success).toBe(true);
    expect(LookupDetailQuery.safeParse({ source: "tmdb", id: "https://evil" }).success).toBe(false);
    expect(LookupQuery.safeParse({ kind: "book", q: "  " }).success).toBe(false);
  });
  it("limits genres", () => {
    const base = { source: "tmdb", externalId: "movie/1" };
    expect(CreateMediaInput.safeParse({ ...base, genres: [] }).success).toBe(false);
    expect(CreateMediaInput.safeParse({ ...base, genres: ["a", "b", "c", "d"] }).success).toBe(false);
    expect(CreateMediaInput.safeParse({ ...base, genres: ["a", "a"] }).success).toBe(false);
    expect(CreateMediaInput.safeParse({ ...base, genres: ["drama"], title: "forged" }).success).toBe(false);
  });
  it("tolerates junk browse filters", () => {
    expect(BrowseQuery.parse({ kind: "nope", sort: "x", genre: "Bad Genre", q: "" })).toEqual({});
    expect(BrowseQuery.parse({ kind: "book", q: " dune " })).toEqual({ kind: "book", q: "dune" });
  });
  it("knows company roles", () => {
    expect(isCompanyRole("studio")).toBe(true);
    expect(isCompanyRole("actor")).toBe(false);
  });
});

describe("browse paging and credits", () => {
  it("decodes offsets safely", () => {
    expect(decodeOffset(undefined)).toBe(0);
    expect(decodeOffset("48")).toBe(48);
    expect(decodeOffset("9999")).toBe(2000);
    expect(decodeOffset("-1")).toBe(0);
    expect(nextOffset(0, 25)).toBe("24");
    expect(nextOffset(0, 24)).toBeNull();
    expect(nextOffset(1990, 25)).toBeNull();
  });
  it("groups and labels credits", () => {
    const g = groupCredits([{ role: "actor" }, { role: "director" }, { role: "actor" }]);
    expect(g.map((x) => [x.role, x.items.length])).toEqual([["director", 1], ["actor", 2]]);
    expect(roleLabel("director", 2)).toBe("Directors");
    expect(roleLabel("composer", 1)).toBe("Music");
    expect(roleLabel("zzz", 1)).toBe("zzz");
    expect(roleAllowed("book", "author")).toBe(true);
    expect(roleAllowed("book", "director")).toBe(false);
  });
});

describe("verdicts", () => {
  const at = new Date("2026-11-18T00:00:00Z");
  it("says nothing firm on thin data", () => {
    expect(verdictKind({ uses_ai: 0, no_ai: 0, unsure: 0 })).toBe("none");
    expect(verdictSentence({ uses_ai: 0, no_ai: 0, unsure: 0 })).toMatch(/No community votes/);
    expect(verdictSentence({ uses_ai: 3, no_ai: 0, unsure: 0 }, { updatedAt: at })).toBe(
      "Too few votes for a community verdict yet: 3 votes so far, as of November 18, 2026.",
    );
  });
  it("frames majorities as community votes", () => {
    expect(verdictSentence({ uses_ai: 8, no_ai: 2, unsure: 0 })).toBe("Community votes say it likely used generative AI: 80% of 10 votes.");
    expect(verdictSentence({ uses_ai: 1, no_ai: 9, unsure: 0 }, { underReview: true })).toBe(
      "Community votes say it likely did not use generative AI: 90% of 10 votes. These votes are under review.",
    );
    expect(verdictKind({ uses_ai: 5, no_ai: 5, unsure: 0 })).toBe("split");
    expect(verdictSentence({ uses_ai: 5, no_ai: 5, unsure: 1 })).toMatch(/^Community votes are split: \d+% say it used generative AI and \d+% say it did not, from 11 votes\.$/);
  });
  it("links to the catalogue", () => {
    expect(sourceUrl("tmdb", "tv/5")).toBe("https://www.themoviedb.org/tv/5");
    expect(sourceUrl("openlibrary", "OL1W")).toBe("https://openlibrary.org/works/OL1W");
    expect(sourceUrl("manual", null)).toBeNull();
    expect(sourceUrl("tmdb", "bad")).toBeNull();
    expect(sourceUrl("openlibrary", "bad")).toBeNull();
  });
});

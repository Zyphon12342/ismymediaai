import { describe, expect, it } from "vitest";
import { slugify } from "@/lib/services/slug";

describe("slugify", () => {
  it("makes lower-case hyphenated slugs with the year", () => {
    expect(slugify("The Sample Film", 2024)).toBe("the-sample-film-2024");
  });

  it("strips accents and symbols", () => {
    expect(slugify("Café & Crème: Part II!")).toBe("cafe-and-creme-part-ii");
  });

  it("never returns an empty slug", () => {
    expect(slugify("!!!")).toBe("untitled");
    expect(slugify("???", 1999)).toBe("untitled-1999");
  });

  it("matches the database slug rule", () => {
    const rule = /^[a-z0-9]+(-[a-z0-9]+)*$/;
    for (const t of ["  Leading", "Trailing  ", "a--b", "x".repeat(300)]) {
      const s = slugify(t, 2020);
      expect(s).toMatch(rule);
      expect(s.length).toBeLessThanOrEqual(120);
    }
  });
});

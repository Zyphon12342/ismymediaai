import { describe, expect, it } from "vitest";
import { evidenceUrl, handle, normaliseHttpsUrl, pageQuery } from "@/lib/validation/common";
import { VoteInput } from "@/lib/validation/vote";

describe("evidence links", () => {
  it("accepts and normalises https links", () => {
    expect(evidenceUrl.parse("  https://Example.COM:443/a?b=1#frag ")).toBe("https://example.com/a?b=1");
  });

  it.each(["http://example.com", "javascript:alert(1)", "https://user:pw@example.com", "https://localhost", "not a url"])(
    "rejects %s",
    (input) => {
      expect(evidenceUrl.safeParse(input).success).toBe(false);
    },
  );

  it("rejects links over 2,000 characters", () => {
    expect(normaliseHttpsUrl(`https://example.com/${"a".repeat(2000)}`)).toBeNull();
  });
});

describe("handles", () => {
  it("lower-cases and validates", () => {
    expect(handle.parse("Film_Fan_42")).toBe("film_fan_42");
    expect(handle.safeParse("ab").success).toBe(false);
    expect(handle.safeParse("has space").success).toBe(false);
  });
});

describe("VoteInput", () => {
  it("accepts the three vote values only", () => {
    expect(VoteInput.parse({ value: "uses_ai" })).toEqual({ value: "uses_ai" });
    expect(VoteInput.safeParse({ value: "maybe" }).success).toBe(false);
  });

  it("rejects unknown fields", () => {
    expect(VoteInput.safeParse({ value: "no_ai", user_id: "someone-else" }).success).toBe(false);
  });
});

describe("pageQuery", () => {
  it("defaults to 20 and caps at 50", () => {
    expect(pageQuery.parse({}).limit).toBe(20);
    expect(pageQuery.safeParse({ limit: "51" }).success).toBe(false);
  });
});

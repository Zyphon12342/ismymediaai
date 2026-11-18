import { describe, expect, it } from "vitest";
import { trimEnd, trimStart } from "@/lib/services/text";

describe("trimEnd / trimStart", () => {
  it("removes only the listed trailing characters", () => {
    expect(trimEnd("https://x.test///", "/")).toBe("https://x.test");
    expect(trimEnd("abc==", "=")).toBe("abc");
    expect(trimEnd("link)>]", ")>]")).toBe("link");
    expect(trimEnd("===", "=")).toBe("");
    expect(trimEnd("", "=")).toBe("");
  });
  it("removes only the listed leading characters", () => {
    expect(trimStart("--a-b-", "-")).toBe("a-b-");
    expect(trimStart("abc", "-")).toBe("abc");
  });
  it("stays fast on long runs", () => {
    const s = "/".repeat(100_000) + "x" + "/".repeat(100_000);
    expect(trimEnd(s, "/").length).toBe(100_001);
  });
});

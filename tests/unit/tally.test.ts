import { describe, expect, it } from "vitest";
import { LOW_SAMPLE_THRESHOLD, summarizeTally } from "@/lib/services/tally";

describe("summarizeTally", () => {
  it("returns zeros and a low-sample flag when there are no votes", () => {
    expect(summarizeTally({ uses_ai: 0, no_ai: 0, unsure: 0 })).toEqual({
      total: 0,
      percent: { uses_ai: 0, no_ai: 0, unsure: 0 },
      lowSample: true,
    });
  });

  it("always adds up to exactly 100", () => {
    for (const t of [
      { uses_ai: 1, no_ai: 1, unsure: 1 },
      { uses_ai: 2, no_ai: 1, unsure: 0 },
      { uses_ai: 7, no_ai: 5, unsure: 1 },
      { uses_ai: 999, no_ai: 1, unsure: 1 },
    ]) {
      const { percent } = summarizeTally(t);
      expect(percent.uses_ai + percent.no_ai + percent.unsure).toBe(100);
    }
  });

  it("gives the remainder to the largest fractions", () => {
    expect(summarizeTally({ uses_ai: 1, no_ai: 1, unsure: 1 }).percent).toEqual({ uses_ai: 34, no_ai: 33, unsure: 33 });
  });

  it("flags small samples so a few votes never look like a consensus", () => {
    expect(summarizeTally({ uses_ai: 3, no_ai: 0, unsure: 0 }).lowSample).toBe(true);
    expect(summarizeTally({ uses_ai: LOW_SAMPLE_THRESHOLD, no_ai: 0, unsure: 0 }).lowSample).toBe(false);
  });
});

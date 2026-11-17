export interface Tally {
  uses_ai: number;
  no_ai: number;
  unsure: number;
}

export interface TallySummary {
  total: number;
  /** Whole-number percentages that always add up to 100 (or all 0). */
  percent: Tally;
  /** True when too few votes are counted to read as a consensus. */
  lowSample: boolean;
}

export const LOW_SAMPLE_THRESHOLD = 10;

const KEYS = ["uses_ai", "no_ai", "unsure"] as const;

/**
 * Turn raw counts into display percentages using the largest remainder
 * method, so the three-part vote bar always fills exactly 100%.
 */
export function summarizeTally(t: Tally): TallySummary {
  const total = t.uses_ai + t.no_ai + t.unsure;
  if (total === 0) {
    return { total, percent: { uses_ai: 0, no_ai: 0, unsure: 0 }, lowSample: true };
  }
  const exact = KEYS.map((k) => ({ k, v: (t[k] / total) * 100 }));
  const floored = exact.map(({ k, v }) => ({ k, v: Math.floor(v), r: v - Math.floor(v) }));
  let remaining = 100 - floored.reduce((s, x) => s + x.v, 0);
  for (const x of [...floored].sort((a, b) => b.r - a.r)) {
    if (remaining <= 0) break;
    x.v += 1;
    remaining -= 1;
  }
  const percent = Object.fromEntries(floored.map(({ k, v }) => [k, v])) as unknown as Tally;
  return { total, percent, lowSample: total < LOW_SAMPLE_THRESHOLD };
}

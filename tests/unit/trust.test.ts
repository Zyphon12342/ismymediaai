import { describe, expect, it } from "vitest";
import { canAddTitles, eligibleForLevel1, isBanned, voteCounts } from "@/lib/services/trust";

const now = new Date("2026-11-17T12:00:00Z");
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000);
const base = { trustLevel: 0, emailVerified: true, createdAt: hoursAgo(1), bannedUntil: null };

describe("trust rules", () => {
  it("promotes verified accounts after 72 hours", () => {
    expect(eligibleForLevel1({ ...base, createdAt: hoursAgo(71) }, now)).toBe(false);
    expect(eligibleForLevel1({ ...base, createdAt: hoursAgo(72) }, now)).toBe(true);
    expect(eligibleForLevel1({ ...base, createdAt: hoursAgo(100), emailVerified: false }, now)).toBe(false);
    expect(eligibleForLevel1({ ...base, createdAt: hoursAgo(100), trustLevel: 2 }, now)).toBe(false);
  });

  it("counts votes only from trust level 1+ accounts that are not banned", () => {
    expect(voteCounts(base, now)).toBe(false);
    expect(voteCounts({ ...base, trustLevel: 1 }, now)).toBe(true);
    expect(voteCounts({ ...base, trustLevel: 1, bannedUntil: hoursAgo(-24) }, now)).toBe(false);
    expect(voteCounts({ ...base, trustLevel: 1, bannedUntil: hoursAgo(24) }, now)).toBe(true);
  });

  it("treats only future ban dates as banned", () => {
    expect(isBanned({ bannedUntil: null }, now)).toBe(false);
    expect(isBanned({ bannedUntil: hoursAgo(-1) }, now)).toBe(true);
  });

  it("lets only verified trust level 1+ accounts add titles", () => {
    expect(canAddTitles(base, now)).toBe(false);
    expect(canAddTitles({ ...base, trustLevel: 1 }, now)).toBe(true);
    expect(canAddTitles({ ...base, trustLevel: 1, emailVerified: false }, now)).toBe(false);
  });
});

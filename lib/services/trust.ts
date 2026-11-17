/** Trust level rules. The database is the source of truth; this mirrors them for the UI and jobs. */
export const TRUST_PROMOTION_HOURS = 72;

export interface TrustInput {
  trustLevel: number;
  emailVerified: boolean;
  createdAt: Date;
  bannedUntil: Date | null;
}

export function isBanned(u: Pick<TrustInput, "bannedUntil">, now = new Date()): boolean {
  return u.bannedUntil !== null && u.bannedUntil > now;
}

/** Whether this account's vote counts in the public tally. */
export function voteCounts(u: TrustInput, now = new Date()): boolean {
  return u.trustLevel >= 1 && !isBanned(u, now);
}

/** Whether the nightly job should promote this account from level 0 to 1. */
export function eligibleForLevel1(u: TrustInput, now = new Date()): boolean {
  const ageHours = (now.getTime() - u.createdAt.getTime()) / 3_600_000;
  return u.trustLevel === 0 && u.emailVerified && ageHours >= TRUST_PROMOTION_HOURS;
}

export function canAddTitles(u: TrustInput, now = new Date()): boolean {
  return u.emailVerified && u.trustLevel >= 1 && !isBanned(u, now);
}

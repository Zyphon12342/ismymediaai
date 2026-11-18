/**
 * 2-step login (TOTP) rules. Moderators and admins must pass it before any
 * moderator power works; the database enforces the same rule through
 * private.is_moderator(), so these helpers only decide where to send people.
 */
export type Aal = "aal1" | "aal2";
type Role = "user" | "moderator" | "admin";

export const SECURITY_PATH = "/settings/security";
export const MFA_PATH = "/auth/mfa";

export const MFA_REQUIRED_MESSAGE = "Moderator tools need 2-step login. Enter your code, or set it up under Settings, Security.";

/** The session's assurance level from JWT claims. Anything unknown counts as aal1. */
export function aalFrom(claims: Record<string, unknown> | null | undefined): Aal {
  return claims?.aal === "aal2" ? "aal2" : "aal1";
}

/** Staff whose session has not passed 2-step login. */
export function needsStepUp(role: Role, aal: Aal): boolean {
  return role !== "user" && aal !== "aal2";
}

/** Where to send someone who needs 2-step login: set it up first, or enter a code. */
export function stepUpPath(hasVerifiedFactor: boolean, next: string): string {
  const q = `?next=${encodeURIComponent(next)}`;
  return hasVerifiedFactor ? `${MFA_PATH}${q}` : `${SECURITY_PATH}${q}`;
}

/** Whether a session should be asked for its code right after sign-in. */
export function shouldChallenge(level: { currentLevel: string | null; nextLevel: string | null } | null): boolean {
  return level?.nextLevel === "aal2" && level.currentLevel !== "aal2";
}

/** Six digits, spaces allowed while typing. Returns the digits or null. */
export function normalizeTotp(input: string): string | null {
  const digits = input.replace(/\s+/g, "");
  return /^\d{6}$/.test(digits) ? digits : null;
}

/** Friendly message for Supabase MFA errors. */
export function mfaErrorMessage(err: { code?: string; message?: string } | null | undefined): string {
  switch (err?.code) {
    case "mfa_verification_failed":
    case "mfa_challenge_expired":
      return "That code didn't work. Codes change every 30 seconds, so try the current one.";
    case "mfa_verification_rejected":
      return "Too many tries. Wait a minute and try again.";
    case "too_many_enrolled_mfa_factors":
      return "You already have the maximum number of authenticator apps. Remove one first.";
    case "mfa_totp_enroll_not_enabled":
    case "mfa_totp_verify_not_enabled":
      return "2-step login is switched off for this site. Ask the site owner to turn on TOTP in Supabase.";
    case "insufficient_aal":
      return "Enter a code from your authenticator app first.";
    default:
      return "Something went wrong. Try again.";
  }
}

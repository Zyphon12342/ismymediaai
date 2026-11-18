/** Cookie consent for PostHog. Pure functions only, shared by server and browser. */

export const CONSENT_COOKIE = "mm_consent";
export const CONSENT_MAX_AGE = 60 * 60 * 24 * 365;
/** Browser events that tell the page about consent changes. */
export const CONSENT_EVENT = "mm-consent";
export const CONSENT_OPEN_EVENT = "mm-consent-open";

export type ConsentChoice = "granted" | "denied";
export type ConsentState = ConsentChoice | "pending";

// EU member states, the rest of the EEA, the UK and Switzerland.
const ASK_FIRST = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU",
  "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE", "IS", "LI", "NO", "GB", "CH",
]);

/**
 * Whether a visitor must opt in before PostHog may store anything or record.
 * `country` is Cloudflare's CF-IPCountry. Unknown or anonymised countries
 * (XX, T1 for Tor) ask first; a missing header (local development) does not.
 */
export function consentRequired(country: string | null | undefined): boolean {
  if (country == null || country === "") return false;
  const c = country.toUpperCase();
  return ASK_FIRST.has(c) || c === "XX" || c === "T1";
}

export function parseConsent(value: string | null | undefined): ConsentChoice | null {
  return value === "granted" || value === "denied" ? value : null;
}

/** A stored choice wins; otherwise ask where the law requires it, else allow. */
export function effectiveConsent(cookieValue: string | null | undefined, country: string | null | undefined): ConsentState {
  return parseConsent(cookieValue) ?? (consentRequired(country) ? "pending" : "granted");
}

/** The Set-Cookie value the banner writes with document.cookie. */
export function consentCookie(choice: ConsentChoice, secure: boolean): string {
  return `${CONSENT_COOKIE}=${choice}; Path=/; Max-Age=${CONSENT_MAX_AGE}; SameSite=Lax${secure ? "; Secure" : ""}`;
}

import { describe, expect, it } from "vitest";
import { consentCookie, consentRequired, effectiveConsent, parseConsent } from "@/lib/analytics/consent";

describe("cookie consent", () => {
  it("asks first in the EU, EEA, UK and Switzerland, and for unknown countries", () => {
    for (const c of ["DE", "fr", "GB", "NO", "CH", "IE", "XX", "T1"]) expect(consentRequired(c)).toBe(true);
    for (const c of ["US", "IN", "CA", "BR"]) expect(consentRequired(c)).toBe(false);
  });
  it("does not ask when there is no country header (local development)", () => {
    expect(consentRequired(null)).toBe(false);
    expect(consentRequired("")).toBe(false);
  });
  it("lets a stored choice win, else asks where required", () => {
    expect(effectiveConsent("denied", "US")).toBe("denied");
    expect(effectiveConsent("granted", "DE")).toBe("granted");
    expect(effectiveConsent(undefined, "DE")).toBe("pending");
    expect(effectiveConsent("junk", "GB")).toBe("pending");
    expect(effectiveConsent(undefined, "US")).toBe("granted");
  });
  it("only accepts the two choices", () => {
    expect(parseConsent("granted")).toBe("granted");
    expect(parseConsent("yes")).toBeNull();
  });
  it("writes a year-long, same-site cookie, secure on https", () => {
    expect(consentCookie("granted", true)).toBe("mm_consent=granted; Path=/; Max-Age=31536000; SameSite=Lax; Secure");
    expect(consentCookie("denied", false)).not.toContain("Secure");
  });
});

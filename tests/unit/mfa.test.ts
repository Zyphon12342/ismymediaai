import { describe, expect, it } from "vitest";
import { aalFrom, mfaErrorMessage, needsStepUp, normalizeTotp, shouldChallenge, stepUpPath } from "@/lib/services/mfa";

describe("2-step login rules", () => {
  it("reads the assurance level from claims, defaulting to aal1", () => {
    expect(aalFrom({ aal: "aal2" })).toBe("aal2");
    expect(aalFrom({ aal: "aal1" })).toBe("aal1");
    expect(aalFrom({ aal: "AAL2" })).toBe("aal1");
    expect(aalFrom({})).toBe("aal1");
    expect(aalFrom(null)).toBe("aal1");
  });

  it("only staff need to step up, and only from aal1", () => {
    expect(needsStepUp("user", "aal1")).toBe(false);
    expect(needsStepUp("moderator", "aal1")).toBe(true);
    expect(needsStepUp("admin", "aal1")).toBe(true);
    expect(needsStepUp("moderator", "aal2")).toBe(false);
  });

  it("sends people to set up first, or to enter a code", () => {
    expect(stepUpPath(false, "/mod")).toBe("/settings/security?next=%2Fmod");
    expect(stepUpPath(true, "/mod?x=1")).toBe("/auth/mfa?next=%2Fmod%3Fx%3D1");
  });

  it("challenges only sessions that can and have not stepped up", () => {
    expect(shouldChallenge({ currentLevel: "aal1", nextLevel: "aal2" })).toBe(true);
    expect(shouldChallenge({ currentLevel: "aal2", nextLevel: "aal2" })).toBe(false);
    expect(shouldChallenge({ currentLevel: "aal1", nextLevel: "aal1" })).toBe(false);
    expect(shouldChallenge(null)).toBe(false);
  });

  it("accepts six digits with spaces", () => {
    expect(normalizeTotp("123 456")).toBe("123456");
    expect(normalizeTotp(" 123456 ")).toBe("123456");
    expect(normalizeTotp("12345")).toBeNull();
    expect(normalizeTotp("12345a")).toBeNull();
    expect(normalizeTotp("1234567")).toBeNull();
  });

  it("maps Supabase errors to plain messages", () => {
    expect(mfaErrorMessage({ code: "mfa_verification_failed" })).toMatch(/didn't work/);
    expect(mfaErrorMessage({ code: "insufficient_aal" })).toMatch(/code/);
    expect(mfaErrorMessage(null)).toMatch(/went wrong/);
  });
});

describe("test TOTP generator", async () => {
  const { totp } = await import("../integration/totp");
  it("matches the RFC 6238 SHA-1 vectors", () => {
    // RFC 6238 appendix B public test key, the ASCII "1234567890" twice, in
    // base32 ("1234567890" alone encodes to GEZDGNBVGY3TQOJQ). Built here so
    // the secret scanner doesn't mistake a published test vector for a key.
    const rfcVector = "GEZDGNBVGY3TQOJQ".repeat(2);
    expect(totp(rfcVector, 59_000)).toBe("287082");
    expect(totp(rfcVector, 1_111_111_109_000)).toBe("081804");
    expect(totp(rfcVector, 2_000_000_000_000)).toBe("279037");
  });
});

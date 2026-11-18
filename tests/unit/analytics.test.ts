import { describe, expect, it } from "vitest";
import { captureBody, ingestTarget, isPrivatePath } from "@/lib/analytics/events";

describe("analytics helpers", () => {
  it("marks sign-in, account and moderator pages private", () => {
    for (const p of ["/sign-in", "/sign-up", "/settings/profile", "/auth/callback", "/reset-password", "/mod"]) expect(isPrivatePath(p)).toBe(true);
    for (const p of ["/", "/titles/x", "/u/someone", "/signed"]) expect(isPrivatePath(p)).toBe(false);
  });
  it("builds a capture payload with the internal id only", () => {
    const b = captureBody("phc_key", "vote_cast", "user-1", { media_id: "m", counted: true });
    expect(b).toMatchObject({ api_key: "phc_key", event: "vote_cast", distinct_id: "user-1", properties: { media_id: "m", counted: true } });
    expect(Object.keys(b.properties)).not.toContain("email");
  });
  it("proxies only to the PostHog host, with static files from the assets host", () => {
    expect(ingestTarget("https://us.i.posthog.com", "i/v0/e/")).toBe("https://us.i.posthog.com/i/v0/e/");
    expect(ingestTarget("https://eu.i.posthog.com", "static/array.js")).toBe("https://eu-assets.i.posthog.com/static/array.js");
    expect(ingestTarget("https://us.i.posthog.com", "../evil")).toBeNull();
    expect(ingestTarget("https://us.i.posthog.com", "a@evil.com/x")).toBeNull();
    expect(ingestTarget("https://us.i.posthog.com", "//evil.com/x")).toBeNull();
    expect(ingestTarget("https://us.i.posthog.com", "/evil.com/x")).toBeNull();
    expect(ingestTarget("https://us.i.posthog.com", "a//b")).toBeNull();
  });
});

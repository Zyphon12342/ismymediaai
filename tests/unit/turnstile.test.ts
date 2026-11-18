import { describe, expect, it } from "vitest";
import { verifyTurnstile } from "@/lib/http/turnstile";
import { pickParams } from "@/lib/http/query";

const ok = (body: unknown) => async () => new Response(JSON.stringify(body), { status: 200 });

describe("verifyTurnstile", () => {
  it("passes when no secret is configured", async () => {
    expect(await verifyTurnstile(null, { secret: undefined })).toBe(true);
  });
  it("needs a token when configured", async () => {
    expect(await verifyTurnstile(null, { secret: "s" })).toBe(false);
    expect(await verifyTurnstile("x".repeat(3000), { secret: "s" })).toBe(false);
  });
  it("checks success and action", async () => {
    expect(await verifyTurnstile("t", { secret: "s", ip: "1.2.3.4", fetchFn: ok({ success: true, action: "a" }), expectedAction: "a" })).toBe(true);
    expect(await verifyTurnstile("t", { secret: "s", fetchFn: ok({ success: true, action: "b" }), expectedAction: "a" })).toBe(false);
    expect(await verifyTurnstile("t", { secret: "s", fetchFn: ok({ success: false }) })).toBe(false);
    expect(await verifyTurnstile("t", { secret: "s", fetchFn: async () => new Response("", { status: 500 }) })).toBe(false);
    expect(await verifyTurnstile("t", { secret: "s", fetchFn: async () => { throw new Error("down"); } })).toBe(false);
  });
});

describe("pickParams", () => {
  it("keeps only named keys", () => {
    expect(pickParams(new URLSearchParams("a=1&b=2&__proto__=x&a=3"), ["a", "c"])).toEqual({ a: "1" });
  });
});

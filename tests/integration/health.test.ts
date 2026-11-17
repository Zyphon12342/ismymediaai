import { describe, expect, it } from "vitest";
import { APP_URL } from "./env";

describe("GET /api/health", () => {
  it("reports ok and reaches the database", async () => {
    const res = await fetch(`${APP_URL}/api/health`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; env: string };
    expect(body.status).toBe("ok");
    expect(res.headers.get("x-request-id")).toBeTruthy();
    expect(res.headers.get("cache-control")).toContain("no-store");
  });

  it("sends the baseline security headers", async () => {
    const res = await fetch(`${APP_URL}/`);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
    expect(res.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
    expect(res.headers.get("x-powered-by")).toBeNull();
  });
});
